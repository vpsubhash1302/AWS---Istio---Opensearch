# AWS EKS-Istio-Opensearch

E-commerce microservices application. This is the application layer of a larger
project that will eventually be deployed to EKS with Istio for service mesh,
Terraform for infra, GitLab CI/CD for delivery, and OpenSearch for log search.

## Services

| Service         | Port | Database    | Responsibility                                  |
|-----------------|------|-------------|--------------------------------------------------|
| user-service    | 3001 | user_db     | Registration, login (JWT), profile               |
| product-service | 3002 | product_db  | Product catalog, stock management                |
| cart-service    | 3003 | cart_db     | Shopping cart per user                           |
| order-service   | 3004 | order_db    | Checkout orchestration (calls cart/product/payment) |
| payment-service | 3005 | payment_db  | Mock payment processing                          |

Each service is independently deployable, owns its own Postgres database, and
communicates with others over REST. All services expose `/health` (liveness)
and `/ready` (readiness, checks DB connectivity) endpoints, and log structured
JSON via pino for later ingestion into OpenSearch.

## Running locally

```bash
docker compose up --build
```

Then try the checkout flow:

```bash
# Register a user
curl -X POST localhost:3001/users/register -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com","password":"secret123"}'

# List products
curl localhost:3002/products

# Add a product to the cart (userId=1, productId=1)
curl -X POST localhost:3003/carts/1/items -H 'Content-Type: application/json' \
  -d '{"productId":1,"quantity":2}'

# Checkout
curl -X POST localhost:3004/orders -H 'Content-Type: application/json' \
  -d '{"userId":1}'
```

## Next steps

- Containerize and push images
- Terraform: EKS cluster + networking
- Istio: mesh install, mTLS, traffic policies for the order-service call graph
- GitLab CI/CD: build/test/push/deploy pipeline
- OpenSearch: ship container logs (Fluent Bit) and index by `service` field
