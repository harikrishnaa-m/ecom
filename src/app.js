const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (
        req.originalUrl === "/api/orders/webhook" ||
        req.originalUrl === "/api/custom-orders/webhook"
      ) {
        req.rawBody = buf;
      }
    },
  }),
);

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/wishlist", require("./routes/wishlistRoutes"));
app.use("/api/addresses", require("./routes/addressRoutes"));
app.use("/api/returns", require("./routes/returnRoutes"));
app.use("/api/cms", require("./routes/cmsRoutes"));
app.use("/api/custom-orders", require("./routes/customOrderRoutes"));
app.use("/api/contact-us", require("./routes/contactUsRoutes"));

module.exports = app;
