# KamySoft POS & ERP — SaaS Multi-Tenant System

A premium, multi-tenant Web-based POS and ERP application with full bilingual (English & Arabic RTL) support.

## Live URLs
| URL | Purpose |
|-----|---------|
| `https://yourdomain.com` | Marketing landing page + store registration |
| `https://demo.yourdomain.com` | Public demo store |
| `https://yourdomain.com/admin` | **SaaS provider admin panel** |
| `https://{storename}.yourdomain.com` | Tenant store (e.g. `tenant1.yourdomain.com`) |

---

## ⚠️ CRITICAL: Wildcard DNS + IIS Setup for Tenant Subdomains

When a new store is created (e.g. `tenant1-mobile3`), it needs to be reachable at `tenant1-mobile3.yourdomain.com`.
This requires **two one-time configurations** on your server — DNS and IIS.

### Step 1 — Add Wildcard DNS Record (in your DNS Provider / Cloudflare)

Log in to wherever `yourdomain.com` DNS is managed (Cloudflare, GoDaddy, etc.) and add:

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| `A` | `*` | `<your-server-IP>` | ✅ Proxied (or DNS only) |

This routes **every subdomain** (`*.yourdomain.com`) to your server IP.  
You only need to do this **once** — it covers all future stores.

> **Cloudflare users**: Go to DNS → Add Record → Type: A, Name: `*`, IPv4: `your-server-IP`, Proxied: ON

---

### Step 2 — Add Wildcard Host Binding in IIS

Open **IIS Manager** on the server:

1. Expand **Sites** → click your KamySoft site
2. In the **Actions** panel (right side) → click **Bindings…**
3. Click **Add**
4. Fill in:
   - **Type**: `https` (or `http` if not using SSL yet)
   - **IP Address**: `All Unassigned`
   - **Port**: `443` (or `80`)
   - **Host name**: `*.yourdomain.com`
5. Click **OK**

> If you already have a binding for `yourdomain.com`, keep it — add `*.yourdomain.com` as a **second binding** on the same site.

---

### Step 3 — SSL Certificate for Wildcard (HTTPS)

For HTTPS on all subdomains, your SSL certificate must be a **wildcard cert** for `*.yourdomain.com`.

**Option A — Certbot (Let's Encrypt) on the server:**
```bash
certbot certonly --manual --preferred-challenges dns -d "*.yourdomain.com" -d "yourdomain.com"
```
Then import the generated `.pem` files into IIS via the **Server Certificates** panel.

**Option B — Cloudflare SSL (recommended if using Cloudflare):**  
Set Cloudflare SSL mode to **Full** or **Full (Strict)**. Cloudflare handles the wildcard cert automatically — no IIS cert needed.

---

## Features
- **Multi-tenant SaaS**: Each store gets its own isolated MongoDB namespace at `storename.yourdomain.com`
- **POS / Cashier System**: Shopping cart with Saudi VAT (15%) and discounts
- **ZATCA-Compliant Invoicing**: Simplified Tax Invoices with QR codes (Phase 2)
- **A4 & Thermal Invoice Printing**: Both print formats bilingual (EN/AR)
- **Dashboard & Analytics**: Sales charts, low-stock alerts, multi-branch support
- **Provider Admin Panel**: Manage all tenant stores at `yourdomain.com/admin`

---

## IIS Deployment (Windows Server)

### Prerequisites
1. **Node.js** — Install on server
2. **IIS URL Rewrite** — [Download](https://www.iis.net/downloads/microsoft/url-rewrite)
3. **iisnode** — [Download](https://github.com/tjanczuk/iisnode)
4. **CGI Feature** — Enable via Server Manager → Add Roles → Web Server (IIS) → Application Development → CGI

### Deployment Steps

```bash
# 1. Build the frontend
cd frontend
npm install
npm run build
cd ..

# 2. Install backend dependencies
npm install --production
```

1. Copy all files (including `server.js`, `package.json`, `web.config`, `frontend/dist/`) to `C:\inetpub\wwwroot\kamysoft-erp`
2. Open **IIS Manager** → Right-click **Sites** → **Add Website**
3. Set **Physical Path** to your folder
4. Add two **Host bindings**:
   - `yourdomain.com` → port 443
   - `*.yourdomain.com` → port 443 (wildcard — covers all tenant stores)
5. Grant `IIS_IUSRS` read/write on the folder

### Environment Variables (.env)

Create a `.env` file in the project root:

```env
MONGO_URI=mongodb://localhost:27017/kamysoft-erp
JWT_SECRET=<48+ random characters>
SAAS_ADMIN_KEY=<16+ random characters>
PORT=8089
```

Generate random values with:
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

> - `JWT_SECRET` is **required**: the server refuses to start if it is missing, shorter than 32 characters, or a value published in this repository. For local development only, `ALLOW_DEV_SECRETS=true` uses a random secret per run.
> - The `SAAS_ADMIN_KEY` is what you enter at `yourdomain.com/admin` to log in as the SaaS provider. There is no default: if it is not set, the provider admin API is disabled.
> - Demo logins (`admin/admin123`, …) are only created when `SEED_DEMO_USERS=true`. Never enable this on a public server.

---

## Docker Deployment

```bash
docker build -t kamysoft-erp:latest .
docker run -d --name kamysoft-erp -p 8089:80 \
  -e MONGO_URI=mongodb://host:27017/kamysoft-erp \
  -e JWT_SECRET=<48+ random characters> \
  -e SAAS_ADMIN_KEY=<16+ random characters> \
  --restart unless-stopped \
  kamysoft-erp:latest
```

---

## MongoDB Index Fix (run once on first deployment)

If you see `E11000 duplicate key error` on product IDs, drop the old single-field index:

```bash
mongosh "mongodb://localhost:27017/kamysoft-erp" --eval "db.products.dropIndex('id_1')"
```

---

#   T r i g g e r   D e p l o y m e n t :   0 6 / 2 7 / 2 0 2 6
## Local Development & Installation

### Using Docker (Recommended)

1. Clone the repository:
`ash
git clone https://github.com/khalilksa33/kamysoft-erp.git
cd kamysoft-erp
`

2. Create a .env file from the sample (or copy the variables below):
`env
MONGO_URI=mongodb://mongo:27017/kamysoft-erp
ALLOW_DEV_SECRETS=true
SEED_DEMO_USERS=true
`

3. Start the application using Docker Compose:
`ash
docker-compose up -d --build
`

4. Access the application:
- Landing Page: http://localhost:8089
- SaaS Admin Panel: http://localhost:8089/saas-admin

### Manual Installation (Node.js)

1. Clone the repository.
2. Install dependencies for the frontend and build it:
`ash
cd frontend
npm install
npm run build
cd ..
`
3. Install backend dependencies:
`ash
npm install
`
4. Start the server:
`ash
node server.js
`
