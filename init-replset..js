// Connect to MongoDB instance
var conn = new Mongo("mongodb1:27017");
var db = conn.getDB("admin");

// Define replica set configuration
var rsConfig = {
  _id: "rs0",
  members: [
    { _id: 0, host: "mongodb1:27017", priority: 2 },
    { _id: 1, host: "mongodb2:27017", priority: 1 },
    { _id: 2, host: "mongodb3:27017", priority: 1 }
  ]
};

// Function to sleep for a given number of milliseconds
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to initialize the replica set
async function initializeReplicaSet() {
  while (true) {
    try {
      var result = rs.initiate(rsConfig);
      if (result.ok === 1) {
        print("Replica set initialized successfully.");
        break;
      } else {
        print(`Replica set initialization failed: ${result.errmsg}. Retrying...`);
        await sleep(5000); // Wait 5 seconds before retrying
      }
    } catch (err) {
      print(`Error initializing replica set: ${err}`);
      await sleep(5000); // Wait 5 seconds before retrying
    }
  }
}

// Execute the replica set initialization function
initializeReplicaSet();