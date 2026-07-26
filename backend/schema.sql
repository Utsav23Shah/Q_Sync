-- PostgreSQL Database Schema for Q_Sync

-- ENUMS
CREATE TYPE business_category AS ENUM ('SALON', 'CLINIC', 'MECHANIC', 'FOOD', 'TAILOR', 'GOVT', 'OTHER');
CREATE TYPE token_status AS ENUM ('WAITING', 'SERVING', 'COMPLETED', 'CANCELLED', 'SKIPPED');

-- TABLES
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    contact_number VARCHAR(20) UNIQUE NOT NULL,
    category business_category NOT NULL,
    custom_resource_name VARCHAR(50) DEFAULT 'Unit', 
    servicing_units INT NOT NULL DEFAULT 1,
    operating_hours JSONB, 
    is_paused BOOLEAN DEFAULT false, 
    status VARCHAR(20) DEFAULT 'PENDING', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendor_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    estimated_time_mins INT NOT NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS queue_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id),
    service_id UUID REFERENCES vendor_services(id),
    token_number INT NOT NULL, 
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20),
    gps_lat DECIMAL(10, 8),
    gps_lng DECIMAL(11, 8),
    photo_url TEXT, 
    status token_status DEFAULT 'WAITING',
    strikes INT DEFAULT 0, 
    assigned_unit INT, 
    is_walk_in BOOLEAN DEFAULT false,
    booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    service_start_time TIMESTAMP,
    service_end_time TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheduled_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id),
    customer_data JSONB, 
    scheduled_time TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'STAGED' 
);

CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'SUPER_ADMIN'
);

CREATE TABLE IF NOT EXISTS customer_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id),
    token_id UUID REFERENCES queue_tokens(id),
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active_ws_connections INT,
    api_error_rate DECIMAL(5,2),
    cpu_usage DECIMAL(5,2)
);
