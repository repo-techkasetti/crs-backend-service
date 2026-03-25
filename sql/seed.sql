-- ================================
-- CLEAN TABLES (DEV ONLY)
-- ================================

TRUNCATE TABLE "Appointment" CASCADE;
TRUNCATE TABLE "OperatorLeave" CASCADE;
TRUNCATE TABLE "Operator" CASCADE;
TRUNCATE TABLE "AvailabilityRule" CASCADE;
TRUNCATE TABLE "Machine" CASCADE;
TRUNCATE TABLE "CenterModality" CASCADE;
TRUNCATE TABLE "ModalityTestConfig" CASCADE;
TRUNCATE TABLE "Center" CASCADE;
TRUNCATE TABLE "Vendor" CASCADE;
TRUNCATE TABLE "Modality" CASCADE;

-- ================================
-- VENDOR
-- ================================

INSERT INTO "Vendor" (id, name, "isActive", "createdAt")
VALUES
('v1', 'HealthCorp', true, NOW());

-- ================================
-- MODALITIES
-- ================================

INSERT INTO "Modality" (id, code, name, "isActive", "createdAt")
VALUES
('mri', 'MRI', 'MRI Scan', true, NOW()),
('ct', 'CT', 'CT Scan', true, NOW());

-- ================================
-- CENTERS
-- ================================

INSERT INTO "Center"
(id, "vendorId", name, address, latitude, longitude, timezone, rating, "isActive", "isDeleted", "createdAt")
VALUES
('c1', 'v1', 'Whitefield Diagnostics', 'Whitefield Bangalore', 12.9698, 77.7500, 'Asia/Kolkata', 4.8, true, false, NOW()),
('c2', 'v1', 'Budget Scan Center', 'Whitefield Bangalore', 12.9710, 77.7520, 'Asia/Kolkata', 4.1, true, false, NOW()),
('c3', 'v1', 'Premium Imaging', 'Indiranagar Bangalore', 12.9784, 77.6408, 'Asia/Kolkata', 4.9, true, false, NOW());

-- ================================
-- CENTER MODALITIES
-- ================================

INSERT INTO "CenterModality" (id, "centerId", "modalityId", "isActive") VALUES
('cm1', 'c1', 'mri', true),
('cm2', 'c1', 'ct', true),
('cm3', 'c2', 'mri', true),
('cm4', 'c2', 'ct', true),
('cm5', 'c3', 'mri', true);

-- ================================
-- MACHINES
-- ================================

INSERT INTO "Machine" (id, "centerId", "modalityId", name, "isActive", "isDeleted")
VALUES
('mach1', 'c1', 'mri', 'MRI Machine A', true, false),
('mach2', 'c1', 'ct', 'CT Machine A', true, false),
('mach3', 'c2', 'mri', 'MRI Machine B', true, false),
('mach4', 'c2', 'ct', 'CT Machine B', true, false),
('mach5', 'c3', 'mri', 'MRI Machine Premium', true, false);

-- ================================
-- OPERATORS
-- ================================

INSERT INTO "Operator" (id, "centerId", "modalityId", name, "isActive", "isDeleted")
VALUES
('op1', 'c1', 'mri', 'Dr A', true, false),
('op2', 'c1', 'ct', 'Dr B', true, false),
('op3', 'c2', 'mri', 'Dr C', true, false),
('op4', 'c2', 'ct', 'Dr D', true, false),
('op5', 'c3', 'mri', 'Dr E', true, false);

-- ================================
-- AVAILABILITY (Mon–Fri 09–17)
-- ================================

INSERT INTO "AvailabilityRule"
(id, "machineId", "dayOfWeek", "startTime", "endTime", "slotMinutes")
VALUES
('ar1','mach1',1,'09:00','17:00',30),
('ar2','mach2',1,'09:00','17:00',30),
('ar3','mach3',1,'09:00','17:00',30),
('ar4','mach4',1,'09:00','17:00',30),
('ar5','mach5',1,'09:00','17:00',30);

-- ================================
-- TEST CONFIG (PRICES DIFFER)
-- ================================

INSERT INTO "ModalityTestConfig"
(id, "modalityId", "testKeyword", "durationMinutes", price, "isDeleted")
VALUES
('tc1','mri','brain',30,5000,false),
('tc2','mri','spine',30,2200,false),
('tc3','ct','plain',20,1800,false);

-- ================================
-- BLOCK ONE SLOT (for realism)
-- ================================

-- INSERT INTO "Appointment"
-- (id, "centerId", "modalityId", "machineId", "operatorId",
--  "testConfigId", "appointmentDate", "startTime", "endTime",
--  status, "isDeleted", "createdAt")
-- VALUES
-- ('a1','c1','mri','mach1','op1',
--  'tc1',
--  '2026-02-06',
--  '2026-02-06 09:00:00',
--  '2026-02-06 09:30:00',
--  'BOOKED',
--  false,
--  NOW());

-- ================================
-- This is commented out because it expects patientId and because this it creating issues.
 -- ===
 -- here only change terminal to ubuntu
 -- psql "postgresql://postgres:pgpassword@localhost:5444/crs-db"   -f sql/seed.sql
 -- ===