# 👟 Sneaker Empire — POS & Inventory System

## ⚡ HOW TO RUN (read carefully)

```
1. Unzip this file — you get a folder called "sneaker-empire-fixed"
2. Open your terminal and navigate INTO that folder:

   cd sneaker-empire-fixed

3. Install packages (only needed once):

   npm install

4. Start the app:

   npm run dev

5. Open your browser at:   http://localhost:5173
```

> ⚠️  If you have an OLD sneaker-empire folder, DELETE IT or run this one in a fresh location.
> Running `npm run dev` from the WRONG folder is the #1 reason pages don't work.

---

## 🔐 Login Credentials

| Name           | Email                          | Password      | Role        |
|----------------|--------------------------------|---------------|-------------|
| David Kariuki  | david@sneakerempire.co.ke      | superadmin123 | Super Admin |
| Sarah Njeri    | sarah@sneakerempire.co.ke      | admin123      | Admin       |
| Jane Mwangi    | jane@sneakerempire.co.ke       | cashier123    | Cashier     |
| Brian Otieno   | brian@sneakerempire.co.ke      | cashier123    | Cashier     |
| Peter Kamau    | peter@sneakerempire.co.ke      | cashier123    | Cashier     |

Click **"Demo Accounts"** on the login screen to auto-fill any of them.

---

## 🗺️ Who Sees What

| Page          | Super Admin | Admin | Cashier |
|---------------|:-----------:|:-----:|:-------:|
| Dashboard     | ✅          | ✅    | ❌      |
| Point of Sale | ✅          | ✅    | ✅      |
| Inventory     | ✅          | ✅    | ❌      |
| Sales Records | ✅          | ✅    | ❌      |
| Users         | ✅          | ✅    | ❌      |
| Reports       | ✅          | ✅    | ❌      |
| Settings      | ✅          | ❌    | ❌      |

Cashiers → land on POS after login
Admins/Super Admin → land on Dashboard after login
