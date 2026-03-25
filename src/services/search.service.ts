import { prisma } from "../lib/prisma.js";
import { getAvailabilitySummary } from "./getAvailabilitySummary.js";

type SortOption = {
  by: "PRICE" | "RATING" | "DISTANCE" | "EARLIEST_AVAILABLE";
  order: "ASC" | "DESC";
};

type SearchPayload = {
  location?: { lat: number; lng: number; radius_km?: number } | null;
  modality?: string | null;
  test_keyword?: string | null;
  preferred_date?: string | null;
  search_window_days?: number;
  sort?: SortOption[];
  limit?: number;
};

function buildDateRange(preferredDate: string, windowDays: number) {
  const start = new Date(preferredDate);
  const end = new Date(preferredDate);
  end.setDate(end.getDate() + windowDays - 1);

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

async function searchService(rawPayload: SearchPayload) {
  const today = new Date().toISOString().split("T")[0];

  // ✅ DEFAULT FALLBACKS (Production-safe)
  const preferred_date = rawPayload.preferred_date ?? today;
  const search_window_days = rawPayload.search_window_days ?? 3;
  const sort =
    rawPayload.sort && rawPayload.sort.length > 0
      ? rawPayload.sort
      : [{ by: "DISTANCE", order: "ASC" }];
  const limit = rawPayload.limit ?? 20;

  const { startDate, endDate } = buildDateRange(
    preferred_date,
    search_window_days
  );

  const centers = await prisma.center.findMany({
    where: {
      isActive: true,
      isDeleted: false,
      modalities: {
        some: {
          isActive: true,
          modality: {
            isActive: true,
            ...(rawPayload.modality && {
              code: rawPayload.modality,
            }),
            testConfigs: {
              some: {
                isDeleted: false,
                ...(rawPayload.test_keyword && {
                  testKeyword: {
                    contains: rawPayload.test_keyword,
                    mode: "insensitive",
                  },
                }),
              },
            },
          },
        },
      },
    },
    include: {
      modalities: {
        where: { isActive: true },
        include: {
          modality: {
            include: {
              testConfigs: {
                where: { isDeleted: false },
              },
            },
          },
        },
      },
    },
  });

  // ===========================
  // ✅ PROMISE BATCHING START
  // ===========================

  const availabilityTasks: Promise<any>[] = [];
  const contextMap: any[] = [];

  for (const center of centers) {
    for (const cm of center.modalities) {
      const modality = cm.modality;

      if (rawPayload.modality && modality.code !== rawPayload.modality)
        continue;

      for (const test of modality.testConfigs) {
        if (
          rawPayload.test_keyword &&
          !test.testKeyword
            .toLowerCase()
            .includes(rawPayload.test_keyword.toLowerCase())
        )
          continue;

        availabilityTasks.push(
          getAvailabilitySummary({
            centerId: center.id,
            modalityId: modality.id,
            testKeyword: test.testKeyword,
            startDate,
            endDate,
          })
        );

        contextMap.push({
          center,
          modality,
          test,
        });
      }
    }
  }

  // 🚀 Run all availability calls in parallel
  const availabilityResults = await Promise.all(availabilityTasks);

  let results: any[] = [];

  for (let i = 0; i < availabilityResults.length; i++) {
    const availability = availabilityResults[i];

    if (availability.totalAvailableSlots === 0) continue;

    results.push({
      ...contextMap[i],
      availability,
    });
  }

  // ===========================
  // ✅ SORTING
  // ===========================

  const { by, order } = sort[0];

  results.sort((a, b) => {
    let valA = 0;
    let valB = 0;

    if (by === "PRICE") {
      valA = a.test.price;
      valB = b.test.price;
    }

    if (by === "RATING") {
      valA = a.center.rating ?? 0;
      valB = b.center.rating ?? 0;
    }

    if (by === "EARLIEST_AVAILABLE") {
      valA = new Date(a.availability.firstAvailableDate || 0).getTime();
      valB = new Date(b.availability.firstAvailableDate || 0).getTime();
    }

    return order === "ASC" ? valA - valB : valB - valA;
  });

  const limited = results.slice(0, limit);

  // ===========================
  // ✅ CARD BUILDING
  // ===========================

  const cards = limited.map((item) => ({
    id: `${item.center.id}|${item.modality.id}|${item.test.id}`,
    sections: [
      { type: "TITLE", value: { text: item.center.name } },
      {
        type: "SUBTITLE",
        value: {
          text: `${item.modality.code} ${item.test.testKeyword}`,
        },
      },
      { type: "META", value: { text: item.center.address } },
      {
        type: "METRICS",
        value: {
          items: [{ label: "Rating", value: item.center.rating }],
        },
      },
      {
        type: "PRICE",
        value: {
          // display: `Starting at ₹${item.test.price}`,
          display: `Fee ₹${item.test.price}`,
          min_price: item.test.price,
          currency: "INR",
        },
      },
      {
        type: "AVAILABILITY",
        value: item.availability,
      },
      {
        type: "CTA",
        value: {
          actions: [
            {
              label: "Book",
              action: "BOOK",
              payload: {
                center_id: item.center.id,
                modality_id: item.modality.id,
                test_config_id: item.test.id,
              },
            },
          ],
        },
      },
    ],
  }));

  return {
    cards,
    meta: {
      total_results: results.length,
      returned: cards.length,
      search_window_days,
      preferred_date,
    },
  };
}
export default searchService;
// ===========================
// TEST RUN
// ===========================
// (async () => {
//   const response = await searchService({
//     modality:"MRI",
//     preferred_date: "2026-03-02",//1 - monday
//     search_window_days:1
//   });

//   console.log(JSON.stringify(response, null, 2));
// })();

// npx tsx src/searchPromise.ts 

/*
Response:
PS C:\Users\DeB\Desktop\DB20feb - v1> npx tsx src/searchPromise.ts
{
  "cards": [],
  "meta": {
    "total_results": 0,
    "returned": 0,
    "search_window_days": 1,
    "preferred_date": "2026-03-03"
  }
}
PS C:\Users\DeB\Desktop\DB20feb - v1> npx tsx src/searchPromise.ts
{
  "cards": [
    {
      "id": "c1|mri|tc1",
      "sections": [
        {
          "type": "TITLE",
          "value": {
            "text": "Whitefield Diagnostics"
          }
        },
        {
          "type": "SUBTITLE",
          "value": {
            "text": "MRI brain"
          }
        },
        {
          "type": "META",
          "value": {
            "text": "Whitefield Bangalore"
          }
        },
        {
          "type": "METRICS",
          "value": {
            "items": [
              {
                "label": "Rating",
                "value": 4.8
              }
            ]
          }
        },
        {
          "type": "PRICE",
          "value": {
            "display": "Starting at ₹5000",
            "min_price": 5000,
            "currency": "INR"
          }
        },
        {
          "type": "AVAILABILITY",
          "value": {
            "totalAvailableSlots": 16,
            "firstAvailableDate": "2026-03-02",
            "earliestAvailableTime": "2026-03-02T03:30:00.000Z"
          }
        },
        {
          "type": "CTA",
          "value": {
            "actions": [
              {
                "label": "Book",
                "action": "BOOK",
                "payload": {
                  "center_id": "c1",
                  "modality_id": "mri",
                  "test_config_id": "tc1"
                }
              }
            ]
          }
        }
      ]
    },
    {
      "id": "c1|mri|tc2",
      "sections": [
        {
          "type": "TITLE",
          "value": {
            "text": "Whitefield Diagnostics"
          }
        },
        {
          "type": "SUBTITLE",
          "value": {
            "text": "MRI spine"
          }
        },
        {
          "type": "META",
          "value": {
            "text": "Whitefield Bangalore"
          }
        },
        {
          "type": "METRICS",
          "value": {
            "items": [
              {
                "label": "Rating",
                "value": 4.8
              }
            ]
          }
        },
        {
          "type": "PRICE",
          "value": {
            "display": "Starting at ₹2200",
            "min_price": 2200,
            "currency": "INR"
          }
        },
        {
          "type": "AVAILABILITY",
          "value": {
            "totalAvailableSlots": 16,
            "firstAvailableDate": "2026-03-02",
            "earliestAvailableTime": "2026-03-02T03:30:00.000Z"
          }
        },
        {
          "type": "CTA",
          "value": {
            "actions": [
              {
                "label": "Book",
                "action": "BOOK",
                "payload": {
                  "center_id": "c1",
                  "modality_id": "mri",
                  "test_config_id": "tc2"
                }
              }
            ]
          }
        }
      ]
    },
    {
      "id": "c1|ct|tc3",
      "sections": [
        {
          "type": "TITLE",
          "value": {
            "text": "Whitefield Diagnostics"
          }
        },
        {
          "type": "SUBTITLE",
          "value": {
            "text": "CT plain"
          }
        },
        {
          "type": "META",
          "value": {
            "text": "Whitefield Bangalore"
          }
        },
        {
          "type": "METRICS",
          "value": {
            "items": [
              {
                "label": "Rating",
                "value": 4.8
              }
            ]
          }
        },
        {
          "type": "PRICE",
          "value": {
            "display": "Starting at ₹1800",
            "min_price": 1800,
            "currency": "INR"
          }
        },
        {
          "type": "AVAILABILITY",
          "value": {
            "totalAvailableSlots": 24,
            "firstAvailableDate": "2026-03-02",
            "earliestAvailableTime": "2026-03-02T03:30:00.000Z"
          }
        },
        {
          "type": "CTA",
          "value": {
            "actions": [
              {
                "label": "Book",
                "action": "BOOK",
                "payload": {
                  "center_id": "c1",
                  "modality_id": "ct",
                  "test_config_id": "tc3"
                }
              }
            ]
          }
        }
      ]
    },
    {
      "id": "c2|mri|tc1",
      "sections": [
        {
          "type": "TITLE",
          "value": {
            "text": "Budget Scan Center"
          }
        },
        {
          "type": "SUBTITLE",
          "value": {
            "text": "MRI brain"
          }
        },
        {
          "type": "META",
          "value": {
            "text": "Whitefield Bangalore"
          }
        },
        {
          "type": "METRICS",
          "value": {
            "items": [
              {
                "label": "Rating",
                "value": 4.1
              }
            ]
          }
        },
        {
          "type": "PRICE",
          "value": {
            "display": "Starting at ₹5000",
            "min_price": 5000,
            "currency": "INR"
          }
        },
        {
          "type": "AVAILABILITY",
          "value": {
            "totalAvailableSlots": 16,
            "firstAvailableDate": "2026-03-02",
            "earliestAvailableTime": "2026-03-02T03:30:00.000Z"
          }
        },
        {
          "type": "CTA",
          "value": {
            "actions": [
              {
                "label": "Book",
                "action": "BOOK",
                "payload": {
                  "center_id": "c2",
                  "modality_id": "mri",
                  "test_config_id": "tc1"
                }
              }
            ]
          }
        }
      ]
    },
    {
      "id": "c2|mri|tc2",
      "sections": [
        {
          "type": "TITLE",
          "value": {
            "text": "Budget Scan Center"
          }
        },
        {
          "type": "SUBTITLE",
          "value": {
            "text": "MRI spine"
          }
        },
        {
          "type": "META",
          "value": {
            "text": "Whitefield Bangalore"
          }
        },
        {
          "type": "METRICS",
          "value": {
            "items": [
              {
                "label": "Rating",
                "value": 4.1
              }
            ]
          }
        },
        {
          "type": "PRICE",
          "value": {
            "display": "Starting at ₹2200",
            "min_price": 2200,
            "currency": "INR"
          }
        },
        {
          "type": "AVAILABILITY",
          "value": {
            "totalAvailableSlots": 16,
            "firstAvailableDate": "2026-03-02",
            "earliestAvailableTime": "2026-03-02T03:30:00.000Z"
          }
        },
        {
          "type": "CTA",
          "value": {
            "actions": [
              {
                "label": "Book",
                "action": "BOOK",
                "payload": {
                  "center_id": "c2",
                  "modality_id": "mri",
                  "test_config_id": "tc2"
                }
              }
            ]
          }
        }
      ]
    },
    {
      "id": "c2|ct|tc3",
      "sections": [
        {
          "type": "TITLE",
          "value": {
            "text": "Budget Scan Center"
          }
        },
        {
          "type": "SUBTITLE",
          "value": {
            "text": "CT plain"
          }
        },
        {
          "type": "META",
          "value": {
            "text": "Whitefield Bangalore"
          }
        },
        {
          "type": "METRICS",
          "value": {
            "items": [
              {
                "label": "Rating",
                "value": 4.1
              }
            ]
          }
        },
        {
          "type": "PRICE",
          "value": {
            "display": "Starting at ₹1800",
            "min_price": 1800,
            "currency": "INR"
          }
        },
        {
          "type": "AVAILABILITY",
          "value": {
            "totalAvailableSlots": 24,
            "firstAvailableDate": "2026-03-02",
            "earliestAvailableTime": "2026-03-02T03:30:00.000Z"
          }
        },
        {
          "type": "CTA",
          "value": {
            "actions": [
              {
                "label": "Book",
                "action": "BOOK",
                "payload": {
                  "center_id": "c2",
                  "modality_id": "ct",
                  "test_config_id": "tc3"
                }
              }
            ]
          }
        }
      ]
    },
    {
      "id": "c3|mri|tc1",
      "sections": [
        {
          "type": "TITLE",
          "value": {
            "text": "Premium Imaging"
          }
        },
        {
          "type": "SUBTITLE",
          "value": {
            "text": "MRI brain"
          }
        },
        {
          "type": "META",
          "value": {
            "text": "Indiranagar Bangalore"
          }
        },
        {
          "type": "METRICS",
          "value": {
            "items": [
              {
                "label": "Rating",
                "value": 4.9
              }
            ]
          }
        },
        {
          "type": "PRICE",
          "value": {
            "display": "Starting at ₹5000",
            "min_price": 5000,
            "currency": "INR"
          }
        },
        {
          "type": "AVAILABILITY",
          "value": {
            "totalAvailableSlots": 16,
            "firstAvailableDate": "2026-03-02",
            "earliestAvailableTime": "2026-03-02T03:30:00.000Z"
          }
        },
        {
          "type": "CTA",
          "value": {
            "actions": [
              {
                "label": "Book",
                "action": "BOOK",
                "payload": {
                  "center_id": "c3",
                  "modality_id": "mri",
                  "test_config_id": "tc1"
                }
              }
            ]
          }
        }
      ]
    },
    {
      "id": "c3|mri|tc2",
      "sections": [
        {
          "type": "TITLE",
          "value": {
            "text": "Premium Imaging"
          }
        },
        {
          "type": "SUBTITLE",
          "value": {
            "text": "MRI spine"
          }
        },
        {
          "type": "META",
          "value": {
            "text": "Indiranagar Bangalore"
          }
        },
        {
          "type": "METRICS",
          "value": {
            "items": [
              {
                "label": "Rating",
                "value": 4.9
              }
            ]
          }
        },
        {
          "type": "PRICE",
          "value": {
            "display": "Starting at ₹2200",
            "min_price": 2200,
            "currency": "INR"
          }
        },
        {
          "type": "AVAILABILITY",
          "value": {
            "totalAvailableSlots": 16,
            "firstAvailableDate": "2026-03-02",
            "earliestAvailableTime": "2026-03-02T03:30:00.000Z"
          }
        },
        {
          "type": "CTA",
          "value": {
            "actions": [
              {
                "label": "Book",
                "action": "BOOK",
                "payload": {
                  "center_id": "c3",
                  "modality_id": "mri",
                  "test_config_id": "tc2"
                }
              }
            ]
          }
        }
      ]
    }
  ],
  "meta": {
    "total_results": 8,
    "returned": 8,
    "search_window_days": 1,
    "preferred_date": "2026-03-02"
  }
}
*/
//  npx tsx src/server.ts