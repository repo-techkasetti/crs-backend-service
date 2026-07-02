import { Request, Response } from "express";
import * as adminSetupService from "../services/adminSetupService";

export async function getVendors(req: Request, res: Response) {
  try {
    const result = await adminSetupService.getVendors();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load vendors" });
  }
}

export async function getCenters(req: Request, res: Response) {
  try {
    const vendorId = String(req.query.vendorId || "");
    if (!vendorId) {
      return res.status(400).json({ message: "vendorId is required" });
    }
    const result = await adminSetupService.getCenters(vendorId);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load centers" });
  }
}

export async function createCenter(req: Request, res: Response) {
  try {
    const { vendorId, name, address, latitude, longitude, timezone } = req.body ?? {};
    if (!vendorId || !name || !address || latitude === undefined || longitude === undefined || !timezone) {
      return res.status(400).json({
        message: "vendorId, name, address, latitude, longitude and timezone are required",
      });
    }
    const result = await adminSetupService.createCenter({
      vendorId: String(vendorId),
      name: String(name),
      address: String(address),
      latitude: Number(latitude),
      longitude: Number(longitude),
      timezone: String(timezone),
    });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create center" });
  }
}

export async function getMachines(req: Request, res: Response) {
  try {
    const centerId = String(req.query.centerId || "");
    const modalityId = String(req.query.modalityId || "");
    if (!centerId || !modalityId) {
      return res.status(400).json({ message: "centerId and modalityId are required" });
    }
    const result = await adminSetupService.getMachines(centerId, modalityId);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load machines" });
  }
}

export async function getCenterModalities(req: Request, res: Response) {
  try {
    const centerId = String(req.query.centerId || "");
    if (!centerId) {
      return res.status(400).json({ message: "centerId is required" });
    }
    const result = await adminSetupService.getCenterModalities(centerId);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load center modalities" });
  }
}

export async function createCenterModality(req: Request, res: Response) {
  try {
    const { centerId, modalityId } = req.body ?? {};
    if (!centerId || !modalityId) {
      return res.status(400).json({ message: "centerId and modalityId are required" });
    }
    const result = await adminSetupService.createCenterModality({
      centerId: String(centerId),
      modalityId: String(modalityId),
    });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create center modality" });
  }
}

export async function createMachine(req: Request, res: Response) {
  try {
    const { centerId, modalityId, name } = req.body ?? {};
    if (!centerId || !modalityId || !name) {
      return res.status(400).json({ message: "centerId, modalityId and name are required" });
    }
    const result = await adminSetupService.createMachine({
      centerId: String(centerId),
      modalityId: String(modalityId),
      name: String(name),
    });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create machine" });
  }
}

export async function getOperators(req: Request, res: Response) {
  try {
    const centerId = String(req.query.centerId || "");
    const modalityId = String(req.query.modalityId || "");
    if (!centerId || !modalityId) {
      return res.status(400).json({ message: "centerId and modalityId are required" });
    }
    const result = await adminSetupService.getOperators(centerId, modalityId);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load operators" });
  }
}

export async function createOperator(req: Request, res: Response) {
  try {
    const { centerId, modalityId, name } = req.body ?? {};
    if (!centerId || !modalityId || !name) {
      return res.status(400).json({ message: "centerId, modalityId and name are required" });
    }
    const result = await adminSetupService.createOperator({
      centerId: String(centerId),
      modalityId: String(modalityId),
      name: String(name),
    });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create operator" });
  }
}

export async function getModalities(req: Request, res: Response) {
  try {
    const result = await adminSetupService.getModalities();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load modalities" });
  }
}

export async function createModality(req: Request, res: Response) {
  try {
    const { code, name, category } = req.body ?? {};
    if (!code || !name) {
      return res.status(400).json({ message: "code and name are required" });
    }
    const result = await adminSetupService.createModality({ code, name, category });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create modality" });
  }
}

export async function getTestConfigs(req: Request, res: Response) {
  try {
    const modalityId = req.query.modalityId ? String(req.query.modalityId) : undefined;
    const result = await adminSetupService.getTestConfigs(modalityId);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load test configs" });
  }
}

export async function createTestConfig(req: Request, res: Response) {
  try {
    const { modalityId, testKeyword, durationMinutes, price } = req.body ?? {};
    if (!modalityId || !testKeyword || !durationMinutes) {
      return res.status(400).json({
        message: "modalityId, testKeyword and durationMinutes are required",
      });
    }
    const result = await adminSetupService.createTestConfig({
      modalityId,
      testKeyword,
      durationMinutes: Number(durationMinutes),
      price: Number(price ?? 0),
    });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create test config" });
  }
}

export async function updateTestConfigPrice(req: Request, res: Response) {
  try {
    const rawTestConfigId = req.params.testConfigId;
    const testConfigId = Array.isArray(rawTestConfigId) ? rawTestConfigId[0] : rawTestConfigId;
    const { price } = req.body ?? {};
    if (!testConfigId || price === undefined) {
      return res.status(400).json({ message: "testConfigId and price are required" });
    }
    const result = await adminSetupService.updateTestConfigPrice(testConfigId, Number(price));
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update price" });
  }
}

export async function upsertAvailabilityRule(req: Request, res: Response) {
  try {
    const rawMachineId = req.params.machineId;
    const rawDayOfWeek = req.params.dayOfWeek;
    const machineId = Array.isArray(rawMachineId) ? rawMachineId[0] : rawMachineId;
    const dayOfWeek = Array.isArray(rawDayOfWeek) ? rawDayOfWeek[0] : rawDayOfWeek;
    const { startTime, endTime, slotMinutes } = req.body ?? {};
    if (!machineId || dayOfWeek === undefined || !startTime || !endTime || !slotMinutes) {
      return res.status(400).json({
        message: "machineId, dayOfWeek, startTime, endTime and slotMinutes are required",
      });
    }
    const result = await adminSetupService.upsertAvailabilityRule({
      machineId,
      dayOfWeek: Number(dayOfWeek),
      startTime,
      endTime,
      slotMinutes: Number(slotMinutes),
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to save availability rule" });
  }
}
