const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Utility Functions
const executeCommand = (command) => {
  console.log(`Executing: ${command}`);
  execSync(command, { stdio: "inherit" });
};

const ensureDirectoryExistence = (filePath) => {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
};

const writeFile = (filePath, content) => {
  ensureDirectoryExistence(filePath);
  fs.writeFileSync(filePath, content);
  console.log(`Created: ${filePath}`);
};

const generateModule = (moduleName) => {
  console.log(`Generating module: ${moduleName}`);
  executeCommand(`npx nest generate module ${moduleName}`);
  executeCommand(`npx nest generate service ${moduleName}`);
  executeCommand(`npx nest generate controller ${moduleName}`);
};

// Script Parameters
const defaultMongoUrl = "mongodb://localhost:27017/dynamicDB";
const defaultPort = 3000;

// Schema Field Generator
const generateSchemaFields = (payload) => {
  return Object.entries(payload)
    .map(([key, type]) => {
      if (typeof type === "object") {
        const nestedFields = generateSchemaFields(type);
        return `@Prop({ type: Object })\n  ${key}: {\n    ${nestedFields}\n  };`;
      } else {
        return `@Prop({ required: true })\n  ${key}: ${type};`;
      }
    })
    .join("\n\n  ");
};

// DTO Field Generator
const generateDtoFields = (payload) => {
  return Object.entries(payload)
    .map(([key, type]) => {
      if (typeof type === "object") {
        const nestedFields = generateDtoFields(type);
        return `@IsObject()\n  ${key}: {\n    ${nestedFields}\n  };`;
      } else {
        const validator =
          type === "string"
            ? "@IsString()"
            : type === "number"
            ? "@IsNumber()"
            : "";
        return `${validator}\n  ${key}: ${type};`;
      }
    })
    .join("\n\n  ");
};

// Main Script
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter the name of the module (e.g., product): ", (moduleName) => {
  if (!moduleName) {
    console.log("Module name is required!");
    rl.close();
    return;
  }

  const className = moduleName.charAt(0).toUpperCase() + moduleName.slice(1); // Capitalize
  const schemaName = `${className}Schema`;
  const dtoName = `Create${className}Dto`;

  rl.question(
    "Enter MongoDB URL (default: mongodb://localhost:27017/dynamicDB): ",
    (mongoUrl) => {
      mongoUrl = mongoUrl || defaultMongoUrl;

      rl.question("Enter Port (default: 3000): ", (port) => {
        port = port || defaultPort;

        rl.question(
          'Enter payload fields as JSON (e.g., {"name":"string","age":"number"}): ',
          (payloadInput) => {
            let payload;
            try {
              payload = JSON.parse(payloadInput);
            } catch (error) {
              console.log("Invalid JSON format for payload. Exiting...");
              rl.close();
              return;
            }

            console.log(`Creating module: ${moduleName}`);

            // Step 1: Create a New NestJS Project
            executeCommand(
              `npx @nestjs/cli new ${moduleName}-microservice --package-manager=yarn`
            );

            // Change Directory
            const servicePath = path.join(
              process.cwd(),
              `${moduleName}-microservice`
            );
            process.chdir(servicePath);

            // Step 2: Install Dependencies
            executeCommand(
              "yarn add @nestjs/mongoose mongoose class-validator class-transformer"
            );
            executeCommand("yarn add @nestjs/mapped-types");

            // Step 3: Generate Module, Service, Controller
            generateModule(moduleName);

            // Step 4: Create Schema
            const schemaContent = `
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class ${className} extends Document {
  ${generateSchemaFields(payload)}
}

export const ${schemaName} = SchemaFactory.createForClass(${className});
`;
            writeFile(
              path.join(
                servicePath,
                `src/${moduleName}/${moduleName}.schema.ts`
              ),
              schemaContent
            );

            // Step 5: Create DTOs
            const createDtoContent = `
import { IsString, IsNumber, IsObject } from 'class-validator';

export class ${dtoName} {
  ${generateDtoFields(payload)}
}
`;
            writeFile(
              path.join(
                servicePath,
                `src/${moduleName}/dto/create-${moduleName}.dto.ts`
              ),
              createDtoContent
            );

            const updateDtoContent = `
import { PartialType } from '@nestjs/mapped-types';
import { ${dtoName} } from './create-${moduleName}.dto';

export class Update${className}Dto extends PartialType(${dtoName}) {}
`;
            writeFile(
              path.join(
                servicePath,
                `src/${moduleName}/dto/update-${moduleName}.dto.ts`
              ),
              updateDtoContent
            );

            // Step 6: Create ApiResponse Utility
            const apiResponseContent = `
export class ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  errors?: string;

  constructor(success: boolean, statusCode: number, message: string, data?: T, errors?: string) {
    this.success = success;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.errors = errors;
  }
}
`;
            writeFile(
              path.join(servicePath, "src/common/api-response.ts"),
              apiResponseContent
            );

            // Step 7: Update Module
            const moduleContent = `
        import { Module } from '@nestjs/common';
        import { MongooseModule } from '@nestjs/mongoose';
        import { ${className}, ${schemaName} } from './${moduleName}.schema';
        import { ${className}Service } from './${moduleName}.service';
        import { ${className}Controller } from './${moduleName}.controller';
        
        @Module({
          imports: [
            MongooseModule.forFeature([{ name: ${className}.name, schema: ${schemaName} }]),
          ],
          controllers: [${className}Controller],
          providers: [${className}Service],
        })
        export class ${className}Module {}
        `;
            writeFile(
              path.join(
                servicePath,
                `src/${moduleName}/${moduleName}.module.ts`
              ),
              moduleContent
            );

            // Step 7: Create Controller
            const controllerContent = `
import { Controller, Get, Post, Put, Delete, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ${className}Service } from './${moduleName}.service';
import { Create${className}Dto } from './dto/create-${moduleName}.dto';
import { Update${className}Dto } from './dto/update-${moduleName}.dto';
import { ApiResponse } from '../common/api-response';

@Controller('${moduleName}')
export class ${className}Controller {
  constructor(private readonly ${moduleName}Service: ${className}Service) {}

  @Post()
  async create(@Body() create${className}Dto: Create${className}Dto) {
    try {
      const result = await this.${moduleName}Service.create(create${className}Dto);
      return new ApiResponse(true, HttpStatus.CREATED, '${className} created successfully', result);
    } catch (error) {
      throw new HttpException(
        new ApiResponse(false, HttpStatus.BAD_REQUEST, 'Failed to create ${className}', null, error.message),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get()
  async findAll() {
    try {
      const result = await this.${moduleName}Service.findAll();
      return new ApiResponse(true, HttpStatus.OK, '${className}s retrieved successfully', result);
    } catch (error) {
      throw new HttpException(
        new ApiResponse(false, HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve ${className}s', null, error.message),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const result = await this.${moduleName}Service.findOne(id);
      return new ApiResponse(true, HttpStatus.OK, '${className} retrieved successfully', result);
    } catch (error) {
      throw new HttpException(
        new ApiResponse(false, HttpStatus.NOT_FOUND, '${className} not found', null, error.message),
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() update${className}Dto: Update${className}Dto) {
    try {
      const result = await this.${moduleName}Service.update(id, update${className}Dto);
      return new ApiResponse(true, HttpStatus.OK, '${className} updated successfully', result);
    } catch (error) {
      throw new HttpException(
        new ApiResponse(false, HttpStatus.BAD_REQUEST, 'Failed to update ${className}', null, error.message),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.${moduleName}Service.remove(id);
      return new ApiResponse(true, HttpStatus.NO_CONTENT, '${className} deleted successfully');
    } catch (error) {
      throw new HttpException(
        new ApiResponse(false, HttpStatus.NOT_FOUND, '${className} not found', null, error.message),
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
`;
            writeFile(
              path.join(
                servicePath,
                `src/${moduleName}/${moduleName}.controller.ts`
              ),
              controllerContent
            );

            // Step 8: Create Service
            const serviceContent = `
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ${className} } from './${moduleName}.schema';
import { Create${className}Dto } from './dto/create-${moduleName}.dto';
import { Update${className}Dto } from './dto/update-${moduleName}.dto';

@Injectable()
export class ${className}Service {
  constructor(@InjectModel(${className}.name) private ${moduleName}Model: Model<${className}>) {}

  async create(create${className}Dto: Create${className}Dto): Promise<${className}> {
    const created = new this.${moduleName}Model(create${className}Dto);
    return created.save();
  }

  async findAll(): Promise<${className}[]> {
    return this.${moduleName}Model.find().exec();
  }

  async findOne(id: string): Promise<${className}> {
    const found = await this.${moduleName}Model.findById(id).exec();
    if (!found) {
      throw new NotFoundException(\`${className} with ID \${id} not found\`);
    }
    return found;
  }

  async update(id: string, update${className}Dto: Update${className}Dto): Promise<${className}> {
    const updated = await this.${moduleName}Model.findByIdAndUpdate(id, update${className}Dto, { new: true }).exec();
    if (!updated) {
      throw new NotFoundException(\`${className} with ID \${id} not found\`);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.${moduleName}Model.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(\`${className} with ID \${id} not found\`);
    }
  }
}
`;
            writeFile(
              path.join(
                servicePath,
                `src/${moduleName}/${moduleName}.service.ts`
              ),
              serviceContent
            );

            // Step 9: Update MongoDB Connection
            const appModuleContent = `
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ${className}Module } from './${moduleName}/${moduleName}.module';

@Module({
  imports: [
    MongooseModule.forRoot('${mongoUrl}'),
    ${className}Module,
  ],
})
export class AppModule {}
`;
            writeFile(
              path.join(servicePath, "src/app.module.ts"),
              appModuleContent
            );

            // Step 10: Run the Application
            console.log(
              "Microservice setup is complete. Running the application..."
            );
            executeCommand("yarn start");

            rl.close();
          }
        );
      });
    }
  );
});
