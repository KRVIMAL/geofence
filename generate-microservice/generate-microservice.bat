
---

#### **3. Create the Batch File for Windows**

The `generate-microservice.bat` file:

```bat
@echo off
:: Check if Node.js is installed
node -v >nul 2>&1
IF ERRORLEVEL 1 (
    echo Node.js is not installed. Please install it first.
    exit /b
)

:: Run the Node.js script
node generate-microservice.js
