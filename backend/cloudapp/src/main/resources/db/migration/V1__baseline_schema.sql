CREATE TABLE cart (
    id BIGSERIAL PRIMARY KEY,
    total NUMERIC(38, 2)
);

CREATE TABLE item (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(38, 2) NOT NULL,
    description VARCHAR(255) NOT NULL
);

CREATE TABLE usertable (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    cart_id BIGINT UNIQUE,
    CONSTRAINT fk_usertable_cart FOREIGN KEY (cart_id) REFERENCES cart (id)
);

CREATE TABLE notes (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    userid BIGINT NOT NULL
);

CREATE TABLE files (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    content_type VARCHAR(255) NOT NULL,
    file_size VARCHAR(255) NOT NULL,
    userid BIGINT NOT NULL,
    file_data BYTEA NOT NULL
);

CREATE TABLE user_order (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    total NUMERIC(38, 2),
    CONSTRAINT fk_user_order_user FOREIGN KEY (user_id) REFERENCES usertable (id)
);

CREATE TABLE cart_items (
    id BIGSERIAL PRIMARY KEY,
    cart_id BIGINT NOT NULL,
    items_id BIGINT NOT NULL,
    CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES cart (id),
    CONSTRAINT fk_cart_items_item FOREIGN KEY (items_id) REFERENCES item (id)
);

CREATE TABLE user_order_items (
    id BIGSERIAL PRIMARY KEY,
    user_order_id BIGINT NOT NULL,
    items_id BIGINT NOT NULL,
    CONSTRAINT fk_user_order_items_order FOREIGN KEY (user_order_id) REFERENCES user_order (id),
    CONSTRAINT fk_user_order_items_item FOREIGN KEY (items_id) REFERENCES item (id)
);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_name VARCHAR(255) NOT NULL,
    PRIMARY KEY (user_id, role_name),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES usertable (id)
);

CREATE INDEX idx_item_name ON item (name);
CREATE INDEX idx_notes_userid ON notes (userid);
CREATE INDEX idx_files_userid ON files (userid);
CREATE INDEX idx_user_order_user_id ON user_order (user_id);
CREATE INDEX idx_cart_items_cart_id ON cart_items (cart_id);
CREATE INDEX idx_cart_items_item_id ON cart_items (items_id);
CREATE INDEX idx_user_order_items_order_id ON user_order_items (user_order_id);
CREATE INDEX idx_user_order_items_item_id ON user_order_items (items_id);
CREATE INDEX idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX idx_user_roles_role_name ON user_roles (role_name);
