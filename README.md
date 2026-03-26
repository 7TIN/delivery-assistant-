# delivery

Backend MVP scaffold for multi-vendor single-rider orchestration.

## Run

```bash
bun run dev
```

Server starts on `http://localhost:3000` by default.

## Endpoints

- `POST /api/v1/orders`
- `GET /api/v1/orders/:orderId`
- `POST /api/v1/orders/:orderId/cancel`
- `GET /api/v1/orders/:orderId/route`
- `GET /health`

## Example request

```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "content-type: application/json" \
  -d '{
    "userId": "usr_001",
    "deliveryLocation": { "lat": 12.9716, "lng": 77.5946, "address": "Bengaluru" },
    "items": [
      { "itemId": "milk", "name": "Milk", "category": "grocery", "merchantId": "grocery_1", "quantity": 2 },
      { "itemId": "burger", "name": "Burger", "category": "food", "merchantId": "food_9", "quantity": 1 },
      { "itemId": "cable", "name": "USB Cable", "category": "electronics", "merchantId": "electronics_2", "quantity": 1 }
    ]
  }'
```

## Notes

- Queue driver defaults to in-memory (`QUEUE_DRIVER=in-memory`).
- `bullmq` + `ioredis` adapter is scaffolded as a placeholder and can be activated after dependencies are installed.
