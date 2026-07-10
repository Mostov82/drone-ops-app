-- CreateTable
CREATE TABLE "Operator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operatorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "issueDate" DATETIME,
    "expiryDate" DATETIME,
    "examNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "License_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InsurancePolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operatorId" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "coverageAmount" INTEGER,
    "startDate" DATETIME,
    "expiryDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InsurancePolicy_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operatorId" TEXT,
    "licenseId" TEXT,
    "insurancePolicyId" TEXT,
    "droneId" TEXT,
    "permitApplicationId" TEXT,
    CONSTRAINT "Document_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_insurancePolicyId_fkey" FOREIGN KEY ("insurancePolicyId") REFERENCES "InsurancePolicy" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES "Drone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_permitApplicationId_fkey" FOREIGN KEY ("permitApplicationId") REFERENCES "PermitApplication" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegulationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "numberValue" REAL,
    "boolValue" BOOLEAN,
    "textValue" TEXT,
    "unit" TEXT,
    "description" TEXT,
    "lastVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RegulationRuleChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "RegulationRuleChange_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RegulationRule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Drone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "weightGrams" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AIRWORTHY',
    "purchaseDate" DATETIME,
    "flightHours" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Drone_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegistrationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "droneId" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "issueDate" DATETIME,
    "expiryDate" DATETIME,
    CONSTRAINT "RegistrationRecord_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES "Drone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Battery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "droneId" TEXT,
    "label" TEXT NOT NULL,
    "model" TEXT,
    "cycleCount" INTEGER NOT NULL DEFAULT 0,
    "healthStatus" TEXT NOT NULL DEFAULT 'GOOD',
    "notes" TEXT,
    CONSTRAINT "Battery_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES "Drone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "droneId" TEXT,
    "kind" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "weightGrams" INTEGER,
    "notes" TEXT,
    CONSTRAINT "Payload_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES "Drone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Accessory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "droneId" TEXT,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "Accessory_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES "Drone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ZoneType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultVerdict" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "MapLayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "verified" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "zoneTypeId" TEXT NOT NULL,
    "mapLayerId" TEXT,
    "geometryJson" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "Zone_zoneTypeId_fkey" FOREIGN KEY ("zoneTypeId") REFERENCES "ZoneType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Zone_mapLayerId_fkey" FOREIGN KEY ("mapLayerId") REFERENCES "MapLayer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FlightLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "droneId" TEXT NOT NULL,
    "payloadId" TEXT,
    "flightLocationId" TEXT,
    "lat" REAL,
    "lng" REAL,
    "plannedAt" DATETIME NOT NULL,
    "purpose" TEXT NOT NULL,
    "plannedAltitudeM" REAL,
    "plannedDurationMin" INTEGER,
    "weatherNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mission_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES "Drone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Mission_payloadId_fkey" FOREIGN KEY ("payloadId") REFERENCES "Payload" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Mission_flightLocationId_fkey" FOREIGN KEY ("flightLocationId") REFERENCES "FlightLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "ranAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passed" BOOLEAN NOT NULL,
    "resultsJson" TEXT NOT NULL,
    CONSTRAINT "ComplianceCheck_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PermitApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" DATETIME,
    "respondedAt" DATETIME,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PermitApplication_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "autoKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "droneId" TEXT NOT NULL,
    "missionId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "result" TEXT,
    "itemResultsJson" TEXT,
    "overrideJustification" TEXT,
    CONSTRAINT "ChecklistRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistRun_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES "Drone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistRun_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "droneId" TEXT,
    "batteryId" TEXT,
    "accessoryId" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "cost" INTEGER,
    "technician" TEXT,
    "clearsGrounding" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MaintenanceRecord_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES "Drone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRecord_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "Battery" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRecord_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "Accessory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "maintenanceRecordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "cost" INTEGER,
    CONSTRAINT "Part_maintenanceRecordId_fkey" FOREIGN KEY ("maintenanceRecordId") REFERENCES "MaintenanceRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "droneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intervalType" TEXT NOT NULL,
    "intervalValue" REAL NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "lastDoneAt" DATETIME,
    "lastDoneHours" REAL,
    "notes" TEXT,
    CONSTRAINT "MaintenanceSchedule_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES "Drone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FlightLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "droneId" TEXT NOT NULL,
    "batteryId" TEXT,
    "missionId" TEXT,
    "checklistRunId" TEXT,
    "date" DATETIME NOT NULL,
    "locationName" TEXT,
    "lat" REAL,
    "lng" REAL,
    "durationMin" INTEGER NOT NULL,
    "purpose" TEXT,
    "outcome" TEXT,
    "notes" TEXT,
    "correctsLogId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlightLog_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES "Drone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FlightLog_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "Battery" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FlightLog_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FlightLog_checklistRunId_fkey" FOREIGN KEY ("checklistRunId") REFERENCES "ChecklistRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FlightLog_correctsLogId_fkey" FOREIGN KEY ("correctsLogId") REFERENCES "FlightLog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flightLogId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "Incident_flightLogId_fkey" FOREIGN KEY ("flightLogId") REFERENCES "FlightLog" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "License_expiryDate_idx" ON "License"("expiryDate");

-- CreateIndex
CREATE INDEX "InsurancePolicy_expiryDate_idx" ON "InsurancePolicy"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "Document_relativePath_key" ON "Document"("relativePath");

-- CreateIndex
CREATE UNIQUE INDEX "RegulationRule_key_key" ON "RegulationRule"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Drone_serial_key" ON "Drone"("serial");

-- CreateIndex
CREATE INDEX "RegistrationRecord_expiryDate_idx" ON "RegistrationRecord"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "ZoneType_code_key" ON "ZoneType"("code");

-- CreateIndex
CREATE INDEX "Zone_zoneTypeId_idx" ON "Zone"("zoneTypeId");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_droneId_idx" ON "MaintenanceSchedule"("droneId");

-- CreateIndex
CREATE UNIQUE INDEX "FlightLog_correctsLogId_key" ON "FlightLog"("correctsLogId");

-- CreateIndex
CREATE INDEX "FlightLog_droneId_date_idx" ON "FlightLog"("droneId", "date");
