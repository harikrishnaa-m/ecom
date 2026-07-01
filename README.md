# Ritika E-commerce Backend

## Overview

This project is a Node.js / Express.js backend for an e-commerce platform.

Key features implemented so far:

- Authentication with JWT
- Admin and user roles
- Category management
- Product management with search, pagination, and price sorting
- Product image upload to DigitalOcean Spaces via `multer`
- Low-stock reporting and stock updates
- MongoDB via Mongoose

---

## Getting Started

### Prerequisites

- Node.js 18+ / 20+
- MongoDB Atlas or local MongoDB
- DigitalOcean Spaces credentials for image uploads

### Install dependencies

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root with:

```env
MONGO_URI="your-mongo-uri"
JWT_SECRET="your_jwt_secret"
DO_SPACES_KEY="your_spaces_key"
DO_SPACES_SECRET="your_spaces_secret"
DO_SPACES_BUCKET="your_spaces_bucket"
DO_SPACES_ENDPOINT="https://<region>.digitaloceanspaces.com"
DO_SPACES_REGION="<region>"
```

### Start the server

```bash
npm run dev
```

---

## API Summary

### Authentication

#### Register user

- `POST /api/auth/register`
- Body: `{ name, email, password }`
- Response: `{ token, user }`

#### Register admin

- `POST /api/auth/register-admin`
- Requires admin JWT
- Body: `{ name, email, password }`
- Response: `{ token, user }`

#### Login

- `POST /api/auth/login`
- Body: `{ email, password }`
- Response: `{ token, user }`

#### Profile

- `GET /api/auth/profile`
- Requires auth JWT
- Response: `{ user }`

---

## Category APIs

### Models

Category has:

- `name` (string, required)
- `slug` (string, required, unique)
- `description` (string)
- `parent` (Category reference)
- `image` (string URL)
- `isActive` (boolean)
- `metadata` (title, keywords, description)
- timestamps

### Endpoints

#### Get categories

- `GET /api/categories`
- Optional query: `page`, `perPage`
- If no `page`, returns all active categories
- If `page` provided, returns paginated results with `perPage` capped at 20

#### Get category by ID

- `GET /api/categories/:id`

#### Create category

- `POST /api/categories`
- Requires admin JWT
- Supports image upload under field `image`
- Body: `name`, `slug`, `description`, `parent`, `metadata`, `isActive`

#### Update category

- `PUT /api/categories/:id`
- Requires admin JWT
- Supports image upload under field `image`

#### Delete category

- `DELETE /api/categories/:id`
- Requires admin JWT

---

## Product APIs

### Models

Product has:

- `name` (string, required)
- `slug` (string, required, unique)
- `description` (string)
- `category` (Category reference, required)
- `price` (number, required)
- `discountPrice` (number)
- `sku` (string)
- `stock` (number)
- `brand` (string)
- `weight` (number)
- `dimensions` (`width`, `height`, `depth`)
- `image` (string URL)
- `images` ([string])
- `tags` ([string])
- `attributes` (mixed JSON)
- `isFeatured` (boolean)
- `isActive` (boolean)
- `metadata` (title, keywords, description)
- timestamps

### Endpoints

#### List products

- `GET /api/products`
- Optional query:
  - `page` (pagination)
  - `perPage` (max 20)
  - `search` (searches `name`, `slug`, `description`, `sku`, `brand`)
  - `sort=price_asc` or `sort=price_desc`
- If no `page`, returns all matching products
- If `page` present, returns paginated results plus pagination metadata

#### Get product by ID

- `GET /api/products/:id`

#### Create product

- `POST /api/products`
- Requires admin JWT
- Supports image upload under `image`
- Body fields:
  - `name`, `slug`, `description`, `category`, `price`
  - `discountPrice`, `sku`, `stock`, `brand`, `weight`
  - `dimensions[width]`, `dimensions[height]`, `dimensions[depth]`
  - `tags[]`, `attributes`, `isFeatured`, `isActive`, `metadata`

#### Update product

- `PUT /api/products/:id`
- Requires admin JWT
- Supports image upload under `image`

#### Update stock only

- `PATCH /api/products/:id/stock`
- Requires admin JWT
- Body: `{ stock }`

#### Low stock products

- `GET /api/products/low-stock`
- Requires admin JWT
- Optional `search` query
- Returns products where `stock < 10`

#### Delete product

- `DELETE /api/products/:id`
- Requires admin JWT

---

## Upload / Storage

### DigitalOcean Spaces

- `src/services/digitalOceanSpaces.js`
- Uses `@aws-sdk/client-s3`
- Uploads image buffer from `multer.memoryStorage()`
- Returns public URL

### Multer config

- `src/middleware/uploadMiddleware.js`
- Accepts image files only
- Max size 5 MB
- Used by categories and products for `image` uploads

---

## Authentication / Security

### Middleware

- `src/middleware/authMiddleware.js`
  - `protect` checks `Authorization: Bearer <token>`
  - `admin` verifies `req.user.role === "admin"`

### JWT

- Signed with `JWT_SECRET`
- Payload includes `userId` and `role`
- Expires in 1 hour

---

## Database

### MongoDB

- Connected in `src/config/db.js`
- Uses `MONGO_URI` from `.env`

### Mongoose Models

- `User`
- `Category`
- `Product`

---

## Missing / Placeholder Features

- Cart routes are currently placeholders and not implemented
- Order routes are currently placeholders and not implemented
- No request validation layer (e.g. Joi, Zod)
- No payment integration
- No address or shipping models
- No user profile update route

---

## Recommended Next Steps

1. Implement cart endpoints
2. Add order creation / order status flow
3. Add address shipping model
4. Add payment integration
5. Add request validation
6. Add tests and API docs

---

## Example requests

### Create category

```bash
curl -X POST "http://localhost:5000/api/categories" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -F "name=Electronics" \
  -F "slug=electronics" \
  -F "description=Consumer electronics" \
  -F "image=@/path/to/image.jpg"
```

### Create product

```bash
curl -X POST "http://localhost:5000/api/products" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -F "name=Sample Product" \
  -F "slug=sample-product" \
  -F "category=<CATEGORY_ID>" \
  -F "price=199.99" \
  -F "image=@/path/to/image.jpg"
```

### List products with search / pagination / sort

```bash
curl "http://localhost:5000/api/products?page=1&perPage=20&search=electronics&sort=price_desc"
```

### Low stock search

```bash
curl "http://localhost:5000/api/products/low-stock?search=phone" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## File map

- `src/server.js`
- `src/app.js`
- `src/config/db.js`
- `src/routes/authRoutes.js`
- `src/routes/categoryRoutes.js`
- `src/routes/productRoutes.js`
- `src/routes/cartRoutes.js` (placeholder)
- `src/routes/orderRoutes.js` (placeholder)
- `src/controllers/authController.js`
- `src/controllers/categoryController.js`
- `src/controllers/productController.js`
- `src/models/User.js`
- `src/models/Category.js`
- `src/models/Product.js`
- `src/middleware/authMiddleware.js`
- `src/middleware/uploadMiddleware.js`
- `src/services/digitalOceanSpaces.js`
