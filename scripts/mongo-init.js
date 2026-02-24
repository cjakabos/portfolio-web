// File: scripts/mongo-init.js
// MongoDB initialization script - creates database and user

// Switch to the target database
db = db.getSiblingDB('ai_orchestration');

// Create the application user
db.createUser({
  user: 'orchestration_user',
  pwd: 'orchestration_pass',
  roles: [
    {
      role: 'readWrite',
      db: 'ai_orchestration'
    }
  ]
});

// Create collections with indexes
db.createCollection('experiments');
db.createCollection('user_assignments');
db.createCollection('circuit_breaker_backup');
db.createCollection('audit_trail');

// Create indexes for experiments
db.experiments.createIndex({ "status": 1 });
db.experiments.createIndex({ "created_at": -1 });

// Create indexes for user assignments
db.user_assignments.createIndex({ "user_id": 1 });
db.user_assignments.createIndex({ "experiment_id": 1 });
db.user_assignments.createIndex(
  { "user_id": 1, "experiment_id": 1 },
  { unique: true }
);

// Create indexes for audit trail
db.audit_trail.createIndex({ "timestamp": -1 });
db.audit_trail.createIndex({ "user_id": 1 });
db.audit_trail.createIndex({ "request_id": 1 }, { unique: true });
db.audit_trail.createIndex({ "user_id": 1, "timestamp": -1 });

print('MongoDB initialization complete!');
print('Created database: ai_orchestration');
print('Created user: orchestration_user');
print('Created collections: experiments, user_assignments, circuit_breaker_backup, audit_trail');