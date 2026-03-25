import { prisma } from "../lib/prisma.js"

export async function getCenterDetail(centerId: string) {
  const center = await prisma.center.findFirst({
    where: {
      id: centerId,
      isActive: true,
      isDeleted: false,
    },
    include: {
      modalities: {
        where: {
          isActive: true,
        },
        include: {
          modality: {
            include: {
              testConfigs: {
                where: {
                  isDeleted: false,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!center) {
    throw new Error("Center not found")
  }

  return {
    id: center.id,
    name: center.name,
    address: center.address,
    latitude: center.latitude,
    longitude: center.longitude,
    rating: center.rating,
    modalities: center.modalities.map((cm) => ({
      id: cm.modality.id,
      name: cm.modality.name,
      code: cm.modality.code,
      tests: cm.modality.testConfigs.map((test) => ({
        id: test.id,
        testKeyword: test.testKeyword,
        durationMinutes: test.durationMinutes,
        price: test.price,
      })),
    })),
  }
}