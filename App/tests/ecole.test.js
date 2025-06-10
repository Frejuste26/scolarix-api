import request from 'supertest';
import App from '../app.js'; // Assuming App/app.js exports the app instance or a way to get it
import { db, initializeModels } from '../Models/index.js'; // To ensure models are loaded and db object is available

let appInstance;
let server;
let adminUser;
let authToken;
let testEcoleForAdmin;

// Helper function to get the application instance
async function getApp() {
  const mainApp = new App();
  await mainApp.Launch(); // This initializes DB, models, and starts server.
  return mainApp.app; // The express app instance
}


beforeAll(async () => {
  // Initialize models and database connection
  // The initializeModels function from Models/index.js should handle this.
  // It uses process.env values, which are now from .env.test
  try {
    await initializeModels(); // This will also sync the database if DB_SYNC=true

    // 1. Create a prerequisite Ecole for the admin user
    // Ensure ecoleId is unique and matches the expected format
    const adminEcoleData = { ecoleId: 'ECADM', ecoleName: 'Admin Academy', ville: 'Testville' };
    // Use findOrCreate to prevent errors if it already exists from a previous failed run
    [testEcoleForAdmin] = await db.Ecole.findOrCreate({
        where: { ecoleId: adminEcoleData.ecoleId },
        defaults: adminEcoleData
    });


    // 2. Create an Administrator user
    const adminData = {
      username: 'testadmin',
      password: 'password123',
      userRole: 'Administrator',
      ecoleId: testEcoleForAdmin.ecoleId,
    };
    // Use findOrCreate for the admin user as well
     [adminUser] = await db.User.findOrCreate({
        where: { username: adminData.username },
        defaults: adminData
     });


    // Manually start the app for testing after seeding
    // We need the actual Express app object for supertest
    const mainApp = new App();
    await mainApp.Launch(); // This now uses the test DB
    appInstance = mainApp.app; // Get the express app
    server = mainApp.server; // Assuming App class exposes the server instance


    // 3. Log in as the Administrator to get a token
    const loginResponse = await request(appInstance)
      .post('/scolarix-api/v1/login')
      .send({ username: 'testadmin', password: 'password123' });

    if (loginResponse.status !== 200 || !loginResponse.body.token) {
        console.error('Admin login failed:', loginResponse.body);
        throw new Error('Admin login failed in beforeAll. Cannot proceed with tests.');
    }
    authToken = loginResponse.body.token;

  } catch (error) {
    console.error('Error in beforeAll setup:', error);
    // Ensure server is closed if it started
    if (server && server.close) {
        await new Promise(resolve => server.close(resolve));
    }
    throw error; // Re-throw to fail the test suite
  }
});

afterAll(async () => {
  try {
    // Clean up: Delete the created users and ecoles
    // Order matters due to foreign key constraints if applicable (though paranoid should handle it)
    if (adminUser) {
        // Need to fetch the user again to call destroy, as adminUser is just data
        const user = await db.User.findOne({ where: { username: 'testadmin' }});
        if (user) await user.destroy({ force: true }); // force true for hard delete in tests
    }
    if (testEcoleForAdmin) {
        const ecole = await db.Ecole.findByPk('ECADM');
        if (ecole) await ecole.destroy({ force: true });
    }
    // Also destroy any ecoles created during tests
    await db.Ecole.destroy({ where: { ecoleId: 'EC001' }, force: true });


    // Close the database connection
    if (db.sequelize) {
      await db.sequelize.close();
    }
    // Close the server
    if (server && server.close) {
      await new Promise(resolve => server.close(resolve));
    }
  } catch (error) {
    console.error('Error in afterAll cleanup:', error);
    // throw error; // Optionally re-throw
  }
});

describe('Ecole API Endpoints', () => {
  const newEcoleData = {
    ecoleId: 'EC001', // Adheres to ^EC[0-9]{3}$
    ecoleName: 'Lycée Test Un',
    iep: 'IEP Test',
    ville: 'Testville',
  };
  let createdEcoleId;

  it('POST /ecoles - should create a new ecole for an authenticated Administrator', async () => {
    const response = await request(appInstance)
      .post('/scolarix-api/v1/ecoles')
      .set('Authorization', `Bearer ${authToken}`)
      .send(newEcoleData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('ecoleId', newEcoleData.ecoleId);
    expect(response.body.data).toHaveProperty('ecoleName', newEcoleData.ecoleName);
    createdEcoleId = response.body.data.ecoleId; // Save for later tests

    // Verify in DB
    const ecoleInDb = await db.Ecole.findByPk(createdEcoleId);
    expect(ecoleInDb).not.toBeNull();
    expect(ecoleInDb.ecoleName).toBe(newEcoleData.ecoleName);
  });

  it('POST /ecoles - should return 400 for missing required fields', async () => {
    const incompleteData = { ecoleId: 'EC002' }; // Missing ecoleName
    const response = await request(appInstance)
      .post('/scolarix-api/v1/ecoles')
      .set('Authorization', `Bearer ${authToken}`)
      .send(incompleteData);
    expect(response.status).toBe(400); // Assuming Joi validation returns 400
  });

  it('POST /ecoles - should return 401 for unauthenticated request', async () => {
    const response = await request(appInstance)
      .post('/scolarix-api/v1/ecoles')
      .send(newEcoleData);
    expect(response.status).toBe(401);
  });

  it('GET /ecoles - should return a list of ecoles for an authenticated user (Admin/Teacher)', async () => {
    const response = await request(appInstance)
      .get('/scolarix-api/v1/ecoles')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    // Check if the created ecole and the admin ecole are in the list
    expect(response.body.data.some(e => e.ecoleId === newEcoleData.ecoleId)).toBe(true);
    expect(response.body.data.some(e => e.ecoleId === 'ECADM')).toBe(true);
  });

  it('GET /ecoles/:id - should return a specific ecole by ID for an authenticated user', async () => {
    expect(createdEcoleId).toBeDefined(); // Ensure ecole was created
    const response = await request(appInstance)
      .get(`/scolarix-api/v1/ecoles/${createdEcoleId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('ecoleId', createdEcoleId);
    expect(response.body.data).toHaveProperty('ecoleName', newEcoleData.ecoleName);
  });

  it('GET /ecoles/:id - should return 404 for a non-existent ecole ID', async () => {
    const response = await request(appInstance)
      .get('/scolarix-api/v1/ecoles/EC999') // Non-existent ID
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(404);
  });

  // TODO: Add tests for PUT and DELETE endpoints
  // TODO: Add tests for authorization (e.g., a Teacher trying to create an Ecole should fail)
});
