CREATE TABLE customer (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255),
    phone_number VARCHAR(255),
    notes VARCHAR(255),
    PRIMARY KEY (id)
);

CREATE TABLE employee (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255),
    PRIMARY KEY (id)
);

CREATE TABLE pet (
    id BIGINT NOT NULL AUTO_INCREMENT,
    pet_type TINYINT,
    name VARCHAR(255),
    customer BIGINT,
    birth_date DATE,
    notes VARCHAR(255),
    PRIMARY KEY (id),
    CONSTRAINT fk_pet_customer FOREIGN KEY (customer) REFERENCES customer (id)
);

CREATE TABLE `schedule` (
    id BIGINT NOT NULL AUTO_INCREMENT,
    date DATE,
    PRIMARY KEY (id)
);

CREATE TABLE employee_skills (
    employee_id BIGINT NOT NULL,
    skills TINYINT,
    CONSTRAINT fk_employee_skills_employee FOREIGN KEY (employee_id) REFERENCES employee (id)
);

CREATE TABLE employee_days_available (
    employee_id BIGINT NOT NULL,
    days_available TINYINT,
    CONSTRAINT fk_employee_days_employee FOREIGN KEY (employee_id) REFERENCES employee (id)
);

CREATE TABLE schedule_employee_skills (
    schedule_id BIGINT NOT NULL,
    employee_skills TINYINT,
    CONSTRAINT fk_schedule_skills_schedule FOREIGN KEY (schedule_id) REFERENCES `schedule` (id)
);

CREATE TABLE schedule_employee_list (
    schedule_id BIGINT NOT NULL,
    employee_list_id BIGINT NOT NULL,
    PRIMARY KEY (schedule_id, employee_list_id),
    CONSTRAINT fk_schedule_employee_schedule FOREIGN KEY (schedule_id) REFERENCES `schedule` (id),
    CONSTRAINT fk_schedule_employee_employee FOREIGN KEY (employee_list_id) REFERENCES employee (id)
);

CREATE TABLE schedule_customer_list (
    schedule_id BIGINT NOT NULL,
    customer_list_id BIGINT NOT NULL,
    PRIMARY KEY (schedule_id, customer_list_id),
    CONSTRAINT fk_schedule_customer_schedule FOREIGN KEY (schedule_id) REFERENCES `schedule` (id),
    CONSTRAINT fk_schedule_customer_customer FOREIGN KEY (customer_list_id) REFERENCES customer (id)
);

CREATE TABLE schedule_pet_list (
    schedule_id BIGINT NOT NULL,
    pet_list_id BIGINT NOT NULL,
    PRIMARY KEY (schedule_id, pet_list_id),
    CONSTRAINT fk_schedule_pet_schedule FOREIGN KEY (schedule_id) REFERENCES `schedule` (id),
    CONSTRAINT fk_schedule_pet_pet FOREIGN KEY (pet_list_id) REFERENCES pet (id)
);

CREATE INDEX idx_pet_customer ON pet (customer);
CREATE INDEX idx_employee_skills_employee_id ON employee_skills (employee_id);
CREATE INDEX idx_employee_skills_skill ON employee_skills (skills);
CREATE INDEX idx_employee_days_employee_id ON employee_days_available (employee_id);
CREATE INDEX idx_employee_days_available ON employee_days_available (days_available);
CREATE INDEX idx_schedule_employee_skills_schedule_id ON schedule_employee_skills (schedule_id);
CREATE INDEX idx_schedule_employee_skills_skill ON schedule_employee_skills (employee_skills);
CREATE INDEX idx_schedule_employee_schedule_id ON schedule_employee_list (schedule_id);
CREATE INDEX idx_schedule_employee_employee_id ON schedule_employee_list (employee_list_id);
CREATE INDEX idx_schedule_customer_schedule_id ON schedule_customer_list (schedule_id);
CREATE INDEX idx_schedule_customer_customer_id ON schedule_customer_list (customer_list_id);
CREATE INDEX idx_schedule_pet_schedule_id ON schedule_pet_list (schedule_id);
CREATE INDEX idx_schedule_pet_pet_id ON schedule_pet_list (pet_list_id);
