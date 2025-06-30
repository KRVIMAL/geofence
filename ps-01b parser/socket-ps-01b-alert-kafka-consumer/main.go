package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/segmentio/kafka-go"
)

// PS01BStatusField represents a status field configuration
type PS01BStatusField struct {
	FieldName   string `json:"fieldName"`
	StatusType  string `json:"statusType"` // "Normal" or "Alarm"
	ValueType   string `json:"valueType"`  // "Binary"
	AlarmValue  int    `json:"alarmValue"` // Value that triggers alarm (0 or 1)
	AlarmName   string `json:"alarmName"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Severity    string `json:"severity"`
}

// DeviceState tracks the last known state to avoid duplicate alerts
type DeviceState struct {
	DeviceIMEI      string          `json:"deviceImei"`
	LastStatusHash  string          `json:"lastStatusHash"`
	LastUpdated     time.Time       `json:"lastUpdated"`
	ProcessedEvents map[string]bool `json:"processedEvents"` // eventId -> processed
}

// PS01BAlertProcessor processes PS01B device status and generates alerts
type PS01BAlertProcessor struct {
	// Kafka
	reader *kafka.Reader
	writer *kafka.Writer

	// Device state tracking
	deviceStates map[string]*DeviceState
	statesMutex  sync.RWMutex

	// Status field configurations
	statusFields map[string]PS01BStatusField

	// Stats
	messagesProcessed int64
	alertsGenerated   int64
	processingErrors  int64
	statsMutex        sync.RWMutex
}

// Configuration
const (
	InputTopic    = "ps-01b-json-data"
	OutputTopic   = "ps-01b-alerts"
	ConsumerGroup = "ps-01b-alert-processor"
	BrokerAddress = "103.20.212.44:9092"
)

func main() {
	processor := NewPS01BAlertProcessor()

	if err := processor.Start(); err != nil {
		log.Fatalf("Failed to start processor: %v", err)
	}
}

// NewPS01BAlertProcessor creates a new PS01B alert processor
func NewPS01BAlertProcessor() *PS01BAlertProcessor {
	processor := &PS01BAlertProcessor{
		deviceStates: make(map[string]*DeviceState),
		statusFields: make(map[string]PS01BStatusField),
	}

	processor.initializeStatusFields()
	processor.initializeKafka()

	return processor
}

// initializeStatusFields sets up PS01B status field configurations
func (pap *PS01BAlertProcessor) initializeStatusFields() {
	// Initialize all PS01B status fields based on the images
	statusConfigs := []PS01BStatusField{
		// Normal Status Fields (no alerts)
		{"gpsPositioningMode", "Normal", "Binary", -1, "", "GPS positioning mode (0: GPS not fix, 1: GPS fix)", "System", "INFO"},
		{"gpsValidStatus", "Normal", "Binary", -1, "", "GPS valid status (0: GPS has been not positioned, 1: GPS has been positioned)", "System", "INFO"},
		{"accStatus", "Normal", "Binary", -1, "", "ACC status (0: ACC Low, 1: ACC high)", "System", "INFO"},

		// Alarm Status Fields (generate alerts when value = 1)
		{"sosAlert", "Alarm", "Binary", 1, "SOS Alert", "SOS emergency alert activated", "Security", "CRITICAL"},
		{"internalBatteryLowAlert", "Alarm", "Binary", 1, "Internal Battery Low Alert", "Internal battery voltage is low", "Power", "WARNING"},
		{"powerCutAlarm", "Alarm", "Binary", 1, "Power Cut Alarm", "External power has been cut", "Power", "CRITICAL"},
		{"vibrationAlarm", "Alarm", "Binary", 1, "Vibration Alarm", "Vehicle vibration detected", "Sensor", "WARNING"},
		{"charging", "Alarm", "Binary", 0, "Charging Disconnected", "Device is not charging", "Power", "WARNING"},
		{"defenseStatus", "Alarm", "Binary", 1, "Defense Activated", "Vehicle defense system activated", "Security", "ACTIVE"},
		{"shockAlarm", "Alarm", "Binary", 1, "Shock Alarm", "Shock or impact detected", "Sensor", "WARNING"},
		{"fenceInAlarm", "Alarm", "Binary", 1, "Fence In Alarm", "Vehicle entered restricted area", "Geofence", "WARNING"},
		{"fenceOutAlarm", "Alarm", "Binary", 1, "Fence Out Alarm", "Vehicle exited allowed area", "Geofence", "WARNING"},
		{"overSpeedAlarm", "Alarm", "Binary", 1, "Over Speed Alarm", "Vehicle speed exceeded limit", "Movement", "WARNING"},
		{"rapidAcceleration", "Alarm", "Binary", 1, "Rapid Acceleration", "Harsh acceleration detected", "Movement", "WARNING"},
		{"suddenBrake", "Alarm", "Binary", 1, "Sudden Brake", "Harsh braking detected", "Movement", "WARNING"},
		{"sharpTurn", "Alarm", "Binary", 1, "Sharp Turn", "Sharp turn detected", "Movement", "WARNING"},
		{"alertViaGPRS", "Alarm", "Binary", 1, "Alert via GPRS", "Alert sent via GPRS", "Communication", "ACTIVE"},
		{"alertViaCall", "Alarm", "Binary", 1, "Alert via Call", "Alert sent via voice call", "Communication", "ACTIVE"},
		{"alertViaSMS", "Alarm", "Binary", 1, "Alert via SMS", "Alert sent via SMS", "Communication", "ACTIVE"},
		{"towTheftAlert", "Alarm", "Binary", 1, "Tow/Theft Alert", "Vehicle towing or theft detected", "Security", "CRITICAL"},
		{"lowExternalBatteryAlert", "Alarm", "Binary", 1, "Low External Battery Alert", "External battery voltage is low", "Power", "WARNING"},
		{"voiceControlAlert", "Alarm", "Binary", 1, "Voice Control Alert", "Voice control system alert", "System", "ACTIVE"},

		// Normal Status Fields (state changes but not alarms)
		{"autoDefense", "Normal", "Binary", -1, "", "Auto defense status (0: Normal, 1: Activated)", "Security", "INFO"},
		{"manualDefense", "Normal", "Binary", -1, "", "Manual defense status (0: Normal, 1: Activated)", "Security", "INFO"},
		{"remoteCancellationOfDefense", "Normal", "Binary", -1, "", "Remote cancellation of defense (0: Normal, 1: Activated)", "Security", "INFO"},
		{"tamperSwitch", "Normal", "Binary", -1, "", "Tamper switch status (0: Normal, 1: Activated)", "Security", "INFO"},
		{"tamperAlert", "Normal", "Binary", -1, "", "Tamper alert status (0: Normal, 1: Activated)", "Security", "INFO"},
		{"cutFuelPower", "Normal", "Binary", -1, "", "Cut fuel/power status (0: Normal, 1: Activated)", "System", "INFO"},
		{"connectFuelPower", "Normal", "Binary", -1, "", "Connect fuel/power status (0: Normal, 1: Activated)", "System", "INFO"},
		{"ioPortStatus", "Normal", "Binary", -1, "", "I/O port status (1: High, 0: Low)", "IO", "INFO"},
		{"triggerStatus", "Normal", "Binary", -1, "", "Trigger status (1: Level high, 0: Level low)", "IO", "INFO"},
		{"doorStatus", "Normal", "Binary", -1, "", "Door status (1: ON, 0: OFF)", "Physical", "INFO"},

		// Special handling for electricity connection (reverse logic)
		{"electricityConnectionStatus", "Alarm", "Binary", 0, "Electricity Disconnected", "Oil and electricity disconnected", "Power", "CRITICAL"},
	}

	// Convert to map for easy lookup
	for _, config := range statusConfigs {
		pap.statusFields[config.FieldName] = config
	}

	log.Printf("✅ Initialized %d PS01B status field configurations", len(statusConfigs))

	// Log alarm fields
	alarmFields := []string{}
	for _, config := range statusConfigs {
		if config.StatusType == "Alarm" {
			alarmFields = append(alarmFields, config.FieldName)
		}
	}
	log.Printf("🚨 Monitoring %d alarm fields: %s", len(alarmFields), strings.Join(alarmFields, ", "))
}

// initializeKafka sets up Kafka reader and writer
func (pap *PS01BAlertProcessor) initializeKafka() {
	// Initialize Kafka reader
	pap.reader = kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{BrokerAddress},
		Topic:       InputTopic,
		GroupID:     ConsumerGroup,
		StartOffset: kafka.LastOffset,
		MinBytes:    1,
		MaxBytes:    10e6, // 10MB
	})

	// Initialize Kafka writer
	pap.writer = &kafka.Writer{
		Addr:     kafka.TCP(BrokerAddress),
		Topic:    OutputTopic,
		Balancer: &kafka.LeastBytes{},
	}

	log.Printf("✅ Kafka initialized - Reader: %s, Writer: %s", InputTopic, OutputTopic)
}

// Start begins processing messages
func (pap *PS01BAlertProcessor) Start() error {
	log.Printf("🚀 Starting PS01B Alert Processor...")
	log.Printf("📥 Input Topic: %s", InputTopic)
	log.Printf("📤 Output Topic: %s", OutputTopic)
	log.Printf("🔧 Consumer Group: %s", ConsumerGroup)

	ctx := context.Background()

	// Start stats reporter
	go pap.reportStats()

	// Process messages
	for {
		msg, err := pap.reader.ReadMessage(ctx)
		if err != nil {
			log.Printf("❌ Error reading message: %v", err)
			continue
		}

		// Process the message
		if err := pap.processPS01BData(msg.Value); err != nil {
			pap.statsMutex.Lock()
			pap.processingErrors++
			pap.statsMutex.Unlock()

			log.Printf("❌ Error processing message: %v", err)
			log.Printf("   📄 Message: %s", string(msg.Value)[:min(500, len(msg.Value))])
		}

		pap.statsMutex.Lock()
		pap.messagesProcessed++
		pap.statsMutex.Unlock()
	}
}

// processPS01BData processes a single PS01B JSON message
func (pap *PS01BAlertProcessor) processPS01BData(data []byte) error {
	var rawData map[string]interface{}
	if err := json.Unmarshal(data, &rawData); err != nil {
		return fmt.Errorf("failed to unmarshal JSON: %v", err)
	}

	// Extract key fields
	deviceIMEI := pap.extractStringField(rawData, "deviceImei")
	if deviceIMEI == "" {
		deviceIMEI = pap.extractStringField(rawData, "deviceSerialNo")
	}
	if deviceIMEI == "" {
		return fmt.Errorf("deviceImei field missing or invalid")
	}

	device := pap.extractStringField(rawData, "device")
	packetType := pap.extractStringField(rawData, "packetType")
	ots := pap.extractStringField(rawData, "ots")
	vehicleNo := pap.extractStringField(rawData, "vehicleNo")

	// Only process location packets for PS01B devices
	if packetType != "location" {
		log.Printf("⏭️  Skipping packet type '%s' for PS01B device %s (only processing 'location')",
			packetType, deviceIMEI)
		return nil
	}

	// Verify this is a PS01B device
	if device != "ps01b" {
		log.Printf("⏭️  Skipping non-PS01B device: %s (device: %s)", deviceIMEI, device)
		return nil
	}

	log.Printf("📝 Processing PS01B data: Device %s, PacketType: %s", deviceIMEI, packetType)

	// Check all status fields for alarms
	var alertEvents []map[string]interface{}

	for fieldName, config := range pap.statusFields {
		if config.StatusType == "Alarm" {
			fieldValue := pap.extractIntField(rawData, fieldName)

			// Check if this field value triggers an alarm
			if fieldValue == config.AlarmValue {
				// Create alarm event
				alertEvent := pap.createAlarmEvent(deviceIMEI, vehicleNo, ots, config, fieldValue)
				alertEvents = append(alertEvents, alertEvent)

				log.Printf("🚨 PS01B ALARM: Device %s - %s (%s) - Field: %s=%d",
					deviceIMEI, config.AlarmName, config.Severity, fieldName, fieldValue)
			}
		}
	}

	// If no alarms detected, no need to send alert
	if len(alertEvents) == 0 {
		log.Printf("✅ No alarms detected for PS01B device %s", deviceIMEI)
		return nil
	}

	// Append events to original JSON and send
	pap.appendEventsAndSend(rawData, alertEvents)

	pap.statsMutex.Lock()
	pap.alertsGenerated += int64(len(alertEvents))
	pap.statsMutex.Unlock()

	return nil
}

// createAlarmEvent creates an alarm event structure
func (pap *PS01BAlertProcessor) createAlarmEvent(deviceIMEI, vehicleNo, ots string, config PS01BStatusField, fieldValue int) map[string]interface{} {
	eventID := fmt.Sprintf("PS01B_%s_%s_%s_%d",
		deviceIMEI, strings.ReplaceAll(config.FieldName, " ", "_"),
		strings.ReplaceAll(ots, " ", "_"), time.Now().Unix())

	return map[string]interface{}{
		"eventId":       eventID,
		"packetType":    "PS01B_ALARM",
		"alarmCode":     config.FieldName,
		"eventName":     config.AlarmName,
		"eventType":     "STATUS_ALARM",
		"eventCategory": config.Category,
		"eventStatus":   config.Severity,
		"eventContent":  config.Description,
		"sourceField":   config.FieldName,
		"fieldValue":    fieldValue,
		"alarmValue":    config.AlarmValue,
		"deviceImei":    deviceIMEI,
		"vehicleNo":     vehicleNo,
		"createdAt":     ots,
		"processedAt":   time.Now().UTC().Format("2006-01-02T15:04:05Z"),
	}
}

// appendEventsAndSend appends events to original JSON and sends to Kafka
func (pap *PS01BAlertProcessor) appendEventsAndSend(rawData map[string]interface{}, alertEvents []map[string]interface{}) error {
	// Append events to the original JSON
	existingEvents, exists := rawData["events"]
	var eventsArray []interface{}

	if exists {
		if events, ok := existingEvents.([]interface{}); ok {
			eventsArray = events
		}
	}

	// Add all new alert events
	for _, event := range alertEvents {
		eventsArray = append(eventsArray, event)
	}
	rawData["events"] = eventsArray

	// Send modified JSON to Kafka
	modifiedJSON, err := json.Marshal(rawData)
	if err != nil {
		return fmt.Errorf("failed to marshal modified JSON: %v", err)
	}

	deviceIMEI := pap.extractStringField(rawData, "deviceImei")
	if deviceIMEI == "" {
		deviceIMEI = pap.extractStringField(rawData, "deviceSerialNo")
	}

	msg := kafka.Message{
		Key:   []byte(deviceIMEI),
		Value: modifiedJSON,
		Time:  time.Now(),
	}

	return pap.writer.WriteMessages(context.Background(), msg)
}

// Helper functions for field extraction
func (pap *PS01BAlertProcessor) extractStringField(data map[string]interface{}, key string) string {
	if value, exists := data[key]; exists && value != nil {
		if str, ok := value.(string); ok && str != "" {
			return str
		}
		return fmt.Sprintf("%v", value)
	}
	return ""
}

func (pap *PS01BAlertProcessor) extractIntField(data map[string]interface{}, key string) int {
	if value, exists := data[key]; exists && value != nil {
		switch v := value.(type) {
		case int:
			return v
		case float64:
			return int(v)
		case string:
			if i, err := strconv.Atoi(v); err == nil {
				return i
			}
		}
	}
	return 0
}

// reportStats periodically reports processing statistics
func (pap *PS01BAlertProcessor) reportStats() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		pap.statsMutex.RLock()
		processed := pap.messagesProcessed
		alerts := pap.alertsGenerated
		errors := pap.processingErrors
		pap.statsMutex.RUnlock()

		pap.statesMutex.RLock()
		deviceCount := len(pap.deviceStates)
		pap.statesMutex.RUnlock()

		log.Printf("📊 PS01B STATS: Processed: %d | Alerts: %d | Errors: %d | Devices: %d",
			processed, alerts, errors, deviceCount)
	}
}

// Helper function for minimum
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
