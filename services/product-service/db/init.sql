CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO products (name, description, price, stock) VALUES
  ('Wireless Mouse', 'Ergonomic wireless mouse', 19.99, 100),
  ('Mechanical Keyboard', 'RGB mechanical keyboard', 59.99, 50),
  ('USB-C Hub', '7-in-1 USB-C hub', 29.99, 75)
ON CONFLICT DO NOTHING;
