import { prisma } from "../lib/prisma";

export async function getVendors() {
  return prisma.vendor.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCenters(vendorId: string) {
  return prisma.center.findMany({
    where: {
      vendorId,
      isDeleted: false,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCenter(data: {
  vendorId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  timezone: string;
}) {
  return prisma.center.create({
    data: {
      vendorId: data.vendorId,
      name: data.name.trim(),
      address: data.address.trim(),
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone.trim(),
      rating: 0,
      isActive: true,
      isDeleted: false,
    },
  });
}

export async function getMachines(centerId: string, modalityId: string) {
  return prisma.machine.findMany({
    where: {
      centerId,
      modalityId,
      isDeleted: false,
      isActive: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getCenterModalities(centerId: string) {
  return prisma.centerModality.findMany({
    where: {
      centerId,
      isActive: true,
    },
    include: {
      modality: true,
    },
  });
}

export async function createCenterModality(data: {
  centerId: string;
  modalityId: string;
}) {
  return prisma.centerModality.upsert({
    where: {
      centerId_modalityId: {
        centerId: data.centerId,
        modalityId: data.modalityId,
      },
    },
    update: {
      isActive: true,
    },
    create: {
      centerId: data.centerId,
      modalityId: data.modalityId,
      isActive: true,
    },
    include: {
      modality: true,
    },
  });
}

export async function createMachine(data: {
  centerId: string;
  modalityId: string;
  name: string;
}) {
  return prisma.machine.create({
    data: {
      centerId: data.centerId,
      modalityId: data.modalityId,
      name: data.name.trim(),
      isActive: true,
      isDeleted: false,
    },
  });
}

export async function getOperators(centerId: string, modalityId: string) {
  return prisma.operator.findMany({
    where: {
      centerId,
      modalityId,
      isActive: true,
      isDeleted: false,
    },
    orderBy: { name: "asc" },
  });
}

export async function createOperator(data: {
  centerId: string;
  modalityId: string;
  name: string;
}) {
  return prisma.operator.create({
    data: {
      centerId: data.centerId,
      modalityId: data.modalityId,
      name: data.name.trim(),
      isActive: true,
      isDeleted: false,
    },
  });
}

export async function getModalities() {
  return prisma.modality.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function createModality(data: {
  code: string;
  name: string;
  category?: string | null;
}) {
  return prisma.modality.create({
    data: {
      code: data.code.toUpperCase().trim(),
      name: data.name.trim(),
      category: data.category?.trim() || null,
    },
  });
}

export async function getTestConfigs(modalityId?: string) {
  return prisma.modalityTestConfig.findMany({
    where: {
      isDeleted: false,
      ...(modalityId ? { modalityId } : {}),
    },
    include: {
      modality: true,
    },
    orderBy: { testKeyword: "asc" },
  });
}

export async function createTestConfig(data: {
  modalityId: string;
  testKeyword: string;
  durationMinutes: number;
  price: number;
}) {
  return prisma.modalityTestConfig.create({
    data: {
      modalityId: data.modalityId,
      testKeyword: data.testKeyword.trim().toLowerCase(),
      durationMinutes: data.durationMinutes,
      price: data.price,
    },
    include: {
      modality: true,
    },
  });
}

export async function updateTestConfigPrice(testConfigId: string, price: number) {
  return prisma.modalityTestConfig.update({
    where: { id: testConfigId },
    data: { price },
    include: {
      modality: true,
    },
  });
}

export async function upsertAvailabilityRule(data: {
  machineId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}) {
  return prisma.availabilityRule.upsert({
    where: {
      machineId_dayOfWeek: {
        machineId: data.machineId,
        dayOfWeek: data.dayOfWeek,
      },
    },
    update: {
      startTime: data.startTime,
      endTime: data.endTime,
      slotMinutes: data.slotMinutes,
    },
    create: {
      machineId: data.machineId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      slotMinutes: data.slotMinutes,
    },
  });
}
