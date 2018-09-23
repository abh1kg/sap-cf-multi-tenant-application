var pg = require('pg');

var VCAPServices = JSON.parse(process.env.VCAP_SERVICES);
var PGConfig = VCAPServices.postgresql[0];

var config = {
	host: PGConfig.credentials.hostname, // Server hosting the postgres database
	database: PGConfig.credentials.dbname, //env var: PGDATABASE
	user: PGConfig.credentials.username, //env var: PGUSER
	password: PGConfig.credentials.password, //env var: PGPASSWORD
	port: PGConfig.credentials.port, //env var: PGPORT
	max: 10, // max number of clients in the pool
	idleTimeoutMillis: 30000 // how long a client is allowed to remain idle before being closed
};

//this initializes a connection pool
//it will keep idle connections open for a 30 seconds
//and set a limit of maximum 10 idle clients
var pool = new pg.Pool(config);

var psqlCreateTable = function () {
	var createProductsTableQuery = "CREATE TABLE products ( " +
		"product_id serial CONSTRAINT product_id PRIMARY KEY," +
		"product_name varchar(150) NOT NULL," +
		"product_description varchar(500)," +
		"supplier_name varchar(150) NOT NULL," +
		"price  float NOT NULL," +
		"available boolean NOT NULL," +
		"quantity int," +
		"tenant_id varchar (100) NOT NULL" +
		")";

	pool.connect().then(client => {
		client.query(createProductsTableQuery).then(res => {
			console.log(res);
			client.release();
		}).catch(e => {
			client.release();
			console.error('Query error: ', e.message, e.stack);
		});
	});
};

var psqlInsertValues = function (name, description, supplier, price, availablity, quantity, tenantId, callback) {
	var insertValuesIntoProductsTableQuery =
		"INSERT INTO products (\"product_name\",\"product_description\",\"supplier_name\",\"price\",\"available\",\"quantity\",\"tenant_id\")" +
		"VALUES($1,$2,$3,$4,$5,$6,$7);";

	return pool.connect().then(client => {
		client.query(insertValuesIntoProductsTableQuery, [name, description, supplier, price, availablity, quantity, tenantId]).then(res => {
			console.log(res);
			client.release();
			callback('success');
		}).catch(e => {
			console.error('Query error: ', e.message, e.stack);
			client.release();
			callback('failure');
		});
	});

};

var psqlSelectTenantProducts = function (tenantId, callback) {
	console.log("***!!!***\n");
	console.log("\Tenant Id in DB Interface.js\n" + tenantId + "\n\n**!!**");
	var selectAllProductsQuery = "SELECT * FROM products WHERE \"tenant_id\" = $1";

	return pool.connect().then(client => {
		return client.query(selectAllProductsQuery, [tenantId]).then(function (result) {
			console.log(result);
			callback(result.rows);
			client.release();
		}).catch(e => {
			client.release();
			console.error('Query error: ', e.message, e.stack);
		});
	});
};


/* #region PSQL Test Methods */

var psqlTestSelectAllProducts = function (callback) {
	var selectAllProductsQuery = "SELECT * FROM products";

	return pool.connect().then(client => {
		return client.query(selectAllProductsQuery).then(function (result) {
			console.log(result);
			callback(result.rows);
			client.release();
		}).catch(e => {
			client.release();
			console.error('Query error: ', e.message, e.stack);
		});
	});
};

var psqlTestDropProductTables = function () {
	var dropTableQuery = "DROP TABLE products;";

	pool.connect().then(client => {
		client.query(dropTableQuery).then(res => {
			console.log(res);
			client.release();
		}).catch(e => {
			client.release();
			console.error('Query error: ', e.message, e.stack);
		});
	});
};

var psqlTestDeleteValues = function (productId) {
	var deleteValuesForIdQuery = "DELETE FROM products WHERE products.product_id = $1";

	pool.connect().then(client => {
		client.query(deleteValuesForIdQuery, [productId]).then(res => {
			console.log(res);
			client.release();
		}).catch(e => {
			client.release();
			console.error('Query error: ', e.message, e.stack);
		});
	});

};

var hdbInsertValues = function (PRODUCT_NAME, PRODUCT_DESC, PRODUCT_SUPPLIER, PRODUCT_PRICE, PRODUCT_AVAILABILITY, PRODUCT_QUANTITY,
	callback) {

	var PRODUCT_ID = uuidv4();

	var insertValuesIntoProductsTableQuery = 'INSERT INTO \"PRODUCT_TABLE\" VALUES ( \'' + PRODUCT_ID + '\' , \'' + PRODUCT_NAME + '\' , \'' +
		PRODUCT_DESC + '\' , \'' + PRODUCT_SUPPLIER + '\' , \'' + PRODUCT_PRICE + '\' , \'' + PRODUCT_AVAILABILITY + '\' , \'' +
		PRODUCT_QUANTITY + '\' )';

	var hdb_client = req.db;

	console.log('Executing Query : ' + insertValuesIntoProductsTableQuery);

	return hdb_client.exec(insertValuesIntoProductsTableQuery, function (error, result) {
		if (error) {
			console.log("Error - could not execute create table query: " + error);
			callback('failure');
		}
		callback('success');
	});
};

var hdbSelectAllProducts = function (tenantId, callback) {

	var selectAllProductsQuery = 'SELECT * FROM \"PRODUCT_TABLE\"';

	var hdb_client = req.db;

	console.log('Executing Query : ' + selectAllProductsQuery);

	return hdb_client.exec(selectAllProductsQuery, function (error, result) {
		if (error) {
			console.log("Error - could not execute create table query: " + error);
			callback('failure');
		}
		callback(result);
	});
};

/* #endregion */

module.exports = {
	createTable: psqlCreateTable,
	insertValues: hdbInsertValues,
	deleteValues: psqlTestDeleteValues,
	selectAllProducts: psqlTestSelectAllProducts,
	selectMyProducts: hdbSelectAllProducts,
	dropTable: psqlTestDropProductTables
};