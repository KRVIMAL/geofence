#!/bin/bash

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "Node.js is not installed. Please install it first."
    exit
fi

# Run the Node.js script
node generate-microservice.js
