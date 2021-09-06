const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const app = express();
const session = require('express-session');
const adminName = 'DBSPROJ';
const adminPass = 'DBSPASS';
app.use('/views', express.static('views'));
app.use(express.static(__dirname + '/views'));

let db;
const createConn = async () => {
    db = await mysql.createConnection({
        host: 'localhost',
        user: 'kazam',
        password: '12345678',
        database: 'travelajency',
    });
}
createConn();
app.use(session({
    name: 'sid',
    resave: false,
    saveUninitialized: false,
    secret: '@!#SDQ!@#EWQEFDASFgrhyxuhyjxrhyujasd134',
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 2,
        sameSite: true,
        secure: false
    }
}))
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));


let isNotRegistered = false;
let userAuthID;
let agentID;

app.get('/', (req, res) => {
    res.render('index');
});
//function redirectLogin(req,res,next);
const redirectLogin = (req, res, next) => {
    if (!req.session.userId) {
        res.redirect('/travelerSignInScreen');
    } else {
        next();
    }
}
const redirectAgentLogin = (req, res, next) => {
    if (!req.session.agentId) {
        res.redirect('/agentSignInScreen');
    } else {
        next();
    }
}
const redirectAdmin = (req, res, next) => {
    if (!req.session.adminId) {
        res.redirect('/adminSignIn');
    } else {
        next();
    }
}
let wrongCredentials = false;
app.get('/travelerSignInScreen', (req, res) => {
    res.render('travelerSignInScreen', {
        wrongCredentials
    });
});

app.post('/travelerSignInScreen', async (req, res) => {
    let name = req.body.name.toLowerCase();
    let password = req.body.password;
    let sql = `select * from authtable where name = '${name}' AND password = '${password}' and type='T'`;
    //console.log(sql);
    let [result, fields] = await db.execute(sql);
    if (result.length != 0 && name == result[0].name && password == result[0].password) {
        userAuthID = result[0].AuthID;
        wrongCredentials = false;
        isUserLogIn = true;
        req.session.userId = result[0].AuthID;
        res.redirect('/travelerRegister');
    } else {
        wrongCredentials = true;
        res.redirect('/travelerSignInScreen');
    }
});

let alreadyExist = false;

app.get('/travelerSignUpScreen', (req, res) => {
    res.render('travelerSignUpScreen', {
        alreadyExist
    });
});

app.post('/travelerSignUpScreen', async (req, res) => {
    let name = req.body.name.toLowerCase();
    let password = req.body.password;
    checkQuery = `select * from authtable where name = '${name}'`;
    let [result, fields] = await db.execute(checkQuery);
    if (result.length == 0) {
        alreadyExist = false;
        sql = `insert into authtable(name,password,type) values ('${name}', '${password}','T')`;
        db.execute(sql);
        res.redirect('/travelerSignInScreen');
    } else {
        alreadyExist = true;
        res.redirect('/travelerSignUpScreen');
    }
});
let detailsOfTraveler = [];
let serviceDetails = [];
let agentDetailsForTraveler = [];
app.get('/showTravelerDetails', redirectLogin, async (req, res) => {
    let customerID = req.query.id;
    [result, fields] = await db.execute(`select * from customer c, payments p,address ad, contactdetail con where customerID = ${customerID} and c.paymentid = p.paymentid and ad.addressid = c.addressid and con.contactid = c.contactid`);
    detailsOfTraveler = result;
    [result, fields] = await db.execute(`select * from agent a, address ad, contactdetail con where a.agentid = ${result[0].AgentID} and ad.addressid = a.addressid and con.contactid = a.contactid`);
    agentDetailsForTraveler = result;
    [result, fields] = await db.execute(`select * from services s, bus b, flight f, hotel h, resturaunt r where s.serviceid = ${detailsOfTraveler[0].ServiceID} and s.busid = b.busid and s.flightid = f.flightid and s.hotelid = h.hotelid and s.resturauntid = r.resturauntid`);
    serviceDetails = result;
    let resturauntAddress;
    let hotelAddress;
    if (serviceDetails.length != 0) {
        [result, fields] = await db.execute(`select * from address where addressid = (select addressid from resturaunt where resturauntid = ${serviceDetails[0].ResturauntID})`);
        resturauntAddress = result;
        [result, fields] = await db.execute(`select * from address where addressid = (select addressid from hotel where hotelid = ${serviceDetails[0].HotelID})`);
        hotelAddress = result;
    }
    res.render('showTravelerDetails', {
        detailsOfTraveler,
        serviceDetails,
        agentDetailsForTraveler,
        resturauntAddress,
        hotelAddress
    });
});
app.get('/travelerRegister', redirectLogin, async (req, res) => {
    let forFirstCheck = `select fname from customer where authID = ${userAuthID}`;
    let [result, fields] = await db.execute(forFirstCheck);
    if (result.length == 0) {
        isNotRegistered = true;
    }
    if (isNotRegistered) {
        let sql = 'select * from locations';
        let locations;
        let [result, fields] = await db.execute(sql);
        locations = result;
        res.render('travelerRegister', {
            locations
        });
    } else {
        res.redirect('travelerPanel');
    }
});
app.get('/anotherTrip', redirectLogin, async (req, res) => {
    let [locations, fields] = await db.execute(`select * from locations`);
    res.render('anotherTrip', {
        locations
    });
});
app.post('/anotherTrip', redirectLogin, async (req, res) => {
    let location = req.body.location;
    let startDate = req.body.startDate;
    let endDate = req.body.endDate;
    [result, fields] = await db.execute(`insert into trips (TripStartDate, TripEndDate) values (STR_TO_DATE('${startDate}','%M %d,%Y'), STR_TO_DATE('${endDate}','%M %d,%Y'))`);
    let tripid = result.insertId;
    let getLocBase = `select * from locations where LocationID = ${location}`;
    [result, fields] = await db.execute(getLocBase);
    let setPaymentPrice = `insert into payments (TotalServiceCharges,AdvanceReceived,AdvanceDate,TotalDate,TotalRecived) values (${result[0].BasePrice}+(${result[0].CostPerDay}*(STR_TO_DATE('${endDate}','%M %d,%Y') - STR_TO_DATE('${startDate}','%M %d,%Y'))), 0,'0','0',0)`;
    [result, fields] = await db.execute(setPaymentPrice);
    let paymentID = result;
    [result, fields] = await db.execute(`select * from customer where authid = ${userAuthID}`);
    let customerSql = `INSERT INTO customer (FName, LName, AddressID, CNIC, AuthID, ContactID,paymentID,LocationID, registerDate,tripid) VALUES ('${result[0].FName}','${result[0].LName}',${result[0].AddressID},${result[0].CNIC},${result[0].AuthID},${result[0].ContactID}, ${paymentID.insertId},${location},curdate(),${tripid});`;
    [result, fields] = await db.execute(customerSql);
    customerID = result.insertId;
    res.redirect('/travelerPanel');
});

app.post('/travelerRegister', redirectLogin, async (req, res) => {
    let fname = req.body.fname.toLowerCase();
    let lname = req.body.lname.toLowerCase();
    let CNIC = req.body.CNIC;
    let house = req.body.house.toLowerCase();
    let street = req.body.street.toLowerCase();
    let block = req.body.block.toLowerCase();
    let city = req.body.city.toLowerCase();
    let country = req.body.country.toLowerCase();
    let location = req.body.location;
    let startDate = req.body.startDate;
    let endDate = req.body.endDate;
    let phone = req.body.phone;
    let email = req.body.email.toLowerCase();
    let addressSql = `INSERT INTO address (House, Street, Block, City, Country) VALUES ('${house}', '${street}', '${block}', '${city}', '${country}')`;
    let contactSql = `INSERT INTO contactdetail (PhoneNo,Email) values (${phone},'${email}')`
    let addressID;
    let contactID;
    let [result, fields] = await db.execute(addressSql);
    addressID = result.insertId;
    [result, fields] = await db.execute(contactSql);
    contactID = result.insertId;
    [result, fields] = await db.execute(`insert into trips (TripStartDate, TripEndDate) values (STR_TO_DATE('${startDate}','%M %d,%Y'), STR_TO_DATE('${endDate}','%M %d,%Y'))`);
    let tripid = result.insertId;
    let getLocBase = `select * from locations where LocationID = ${location}`;
    [result, fields] = await db.execute(getLocBase);
    let setPaymentPrice = `insert into payments (TotalServiceCharges,AdvanceReceived,AdvanceDate,TotalDate,TotalRecived) values (${result[0].BasePrice}+(${result[0].CostPerDay}*(STR_TO_DATE('${endDate}','%M %d,%Y') - STR_TO_DATE('${startDate}','%M %d,%Y'))), 0,'0','0',0)`;
    [result, fields] = await db.execute(setPaymentPrice);
    let customerSql = `INSERT INTO customer (FName, LName, LocationID, AddressID, CNIC, AuthID, ContactID,paymentID,tripid,registerDate) VALUES ('${fname}', '${lname}', '${location}', ${addressID}, '${CNIC}', '${userAuthID}', '${contactID}', ${result.insertId},${tripid},curdate());`;
    [result, fields] = await db.execute(customerSql);
    let customerID = result.insertId;
    await db.execute(`insert into tripparticipants (customerid, tripid) values (${customerID}, ${tripid})`);
    isNotRegistered = false;
    res.redirect('/travelerPanel');
});

app.get('/selectTheTripD', redirectLogin, async (req, res) => {               //to show details of traveller that has login.
    let [result, fields] = await db.execute(`select * from customer c, locations l where authid = ${userAuthID} and l.locationid = c.locationid`);
    let version = 'details';
    if (result.length == 1) {
        res.redirect(`/showTravelerDetails?id=${result[0].CustomerID}`);
    } else {
        res.render('selectTheTrip', {                 //if travller has more than 1 register trips then for more than 1 tours panel.
            result,
            version
        });
    }
});
app.get('/selectTheTripC', redirectLogin, async (req, res) => {
    let [result, fields] = await db.execute(`select * from customer c, locations l where authid = ${userAuthID} and l.locationid = c.locationid`);
    let version = 'addPart';
    if (result.length == 1) {
        res.redirect(`/addParticipants?id=${result[0].CustomerID}`);
    } else {
        res.render('selectTheTrip', {
            result,
            version
        });
    }
});
let connectorID = "";
let incorrect = false;
let success = false;
app.get('/addParticipants', redirectLogin, (req, res) => {
    connectorID = req.query.id;
    if (connectorID.length == 0) {
        version = 'addPart';
        res.redirect('/selectTheTrip');
    }
    res.render('addParticipants', {
        incorrect,
        success
    });
});
app.post('/addParticipants', redirectLogin, async (req, res) => {
    let travelID = req.body.travelID;
    let cnic = req.body.cnic;
    let [connector, f] = await db.execute(`select * from customer where customerid = ${connectorID}`);
    let [result, fields] = await db.execute(`select * from customer where customerid = ${travelID} and cnic = ${cnic} and customerid<>${connectorID}`);
    if (result.length == 0) {
        incorrect = true;
        res.redirect(`/addParticipants?id=${connectorID}`);
    } else {
        [result, fields] = await db.execute(`select tripid from customer where customerid = ${connectorID}`);
        [result, fields] = await db.execute(`insert into tripparticipants (customerid, tripid) values (${travelID}, ${result[0].TripID})`);
        if (connector[0].AgentID != null) {
            await db.execute(`update customer set agentid = ${connector[0].AgentID} where customerid = ${travelID}`);
        }
        incorrect = false;
        success = true;
        res.redirect(`/addParticipants?id=${connectorID}`);
    }
});
app.get('/logout', (req, res) => {
    let ver = req.query.ver;
    if (ver == 'Agent') {
        req.session.agentId = 0;
        res.redirect('/AgentSignInScreen');
    } else {
        req.session.userId = 0;
        res.redirect('/travelerSignInScreen');
    }
});
app.get('/travelerPanel', redirectLogin, (req, res) => {
    res.render('travelerPanel');
});

let notCorrect = false;
app.get('/changePasswordTraveler', redirectLogin, (req, res) => {
    res.render('changePasswordTraveler', {
        notCorrect
    });
});

app.post('/changePasswordTraveler', redirectLogin, async (req, res) => {
    let checkIfMatch = `select * from authtable where password = '${req.body.oldPass}'`;
    [result, fields] = await db.execute(checkIfMatch);
    if (result.length == 0) {
        notCorrect = true;
        res.redirect('/changePasswordTraveler');
    } else {
        let changePassQuery = `UPDATE authtable SET password = '${req.body.newPass}' WHERE authtable.AuthID = ${result[0].AuthID};`;
        db.execute(changePassQuery);
    }
    res.redirect('/travelerPanel');
});

app.get('/deleteConfirmation', redirectLogin, (req, res) => {
    res.render('deleteConfirmation');
    let getAllThingsToDelete = `delete from authtable where authId = ${userAuthID}`;
    db.execute(getAllThingsToDelete);
});

app.get('/editDetails', redirectLogin, async (req, res) => {
    let sql = `select * from customer where authID = ${userAuthID}`;
    let [result, fields] = await db.execute(sql);
    let [address, Afields] = await db.execute(`select * from address where addressid = ${result[0].AddressID}`);
    let [contact, Cfields] = await db.execute(`select * from contactdetail where contactid = ${result[0].ContactID}`);
    res.render('editDetails', {
        result,
        address,
        contact
    });
});

app.post('/editDetails', redirectLogin, async (req, res) => {
    let fname = req.body.fname.toLowerCase();
    let lname = req.body.lname.toLowerCase();
    let CNIC = req.body.CNIC;
    let house = req.body.house.toLowerCase();
    let street = req.body.street.toLowerCase();
    let block = req.body.block.toLowerCase();
    let city = req.body.city.toLowerCase();
    let country = req.body.country.toLowerCase();
    let phone = req.body.phone;
    let email = req.body.email;
    let [result, fields] = await db.execute(`select * from customer where authID = ${userAuthID}`);
    let addressSql = `UPDATE address SET House='${house}', Street='${street}', Block='${block}', City='${city}', Country='${country}' where addressid = ${result[0].AddressID}`;
    let contactSql = `UPDATE contactdetail SET PhoneNo=${phone},Email='${email}' where contactid = ${result[0].ContactID}`;
    db.execute(addressSql);
    db.execute(contactSql);
    let customerSql = `UPDATE customer set FName='${fname}', LName='${lname}', CNIC='${CNIC}' where authID = ${userAuthID}`;
    db.execute(customerSql);
    res.redirect('/travelerPanel');
});
wrongCredentials = false;
app.get('/adminSignIn', (req, res) => {
    res.render('adminSignIn', {
        wrongCredentials
    });
});
app.post('/adminSignIn', (req, res) => {
    if (req.body.name.toLowerCase() == adminName.toLowerCase() && req.body.password == adminPass) {
        wrongCredentials = false;
        req.session.adminId = 1;
        res.redirect('adminPanel');
    } else {
        wrongCredentials = true;
        res.redirect('/adminSignIn');
    }
});
app.get('/adminPanel', redirectAdmin, async (req, res) => {
    let [locations, field] = await db.execute(`select l.LocationID locid, count(l.locationid) number, l.locname locname from locations l, customer c where l.LocationID = c.LocationID group by l.LocationID order by count(l.locationid) desc`);
    let [result, fields] = await db.execute(`select registerDate date, count(registerDate) number from customer GROUP by registerDate order by registerDate desc`);
    let dates = result;
    res.render('adminPanel', {
        locations,
        dates
    });
});
let AgentsForAdmin = [];
app.get('/adminPanelAgent', redirectAdmin, (req, res) => {
    res.render('adminPanelAgent', {
        AgentsForAdmin
    });
});
app.post('/adminPanelAgent', redirectAdmin, async (req, res) => {
    let id = req.body.id;
    let name = req.body.name.toLowerCase();
    let city = req.body.city.toLowerCase();
    if (id.length == 0 && name.length == 0 && city.length == 0) {
        let [result, fields] = await db.execute(`select * from agent a`);
        AgentsForAdmin = result;
    } else if (id.length != 0) {
        let [result, fields] = await db.execute(`select * from agent where agentID = ${id}`);
        AgentsForAdmin = result;
    } else if (name.length != 0 && city.length != 0) {
        let [result, fields] = await db.execute(`select locationid from locations where locname = '${city}'`);
        [result, fields] = await db.execute(`select * from agent where locationid = ${result[0].locationid} AND fname ='${name}'`);
        AgentsForAdmin = result;
    } else if (name.length != 0) {
        let [result, fields] = await db.execute(`select * from agent where fname = '${name}'`);
        AgentsForAdmin = result;
    } else if (city.length != 0) {
        let [result, fields] = await db.execute(`select locationid from locations where locname = '${city}'`);
        [result, fields] = await db.execute(`select * from agent where locationid = ${result[0].locationid}`);
        AgentsForAdmin = result;
    }
    res.redirect('/adminPanelAgent');
});
let travelersForAdmin = [];
app.get('/adminPanelTraveller', redirectAdmin, async (req, res) => {
    res.render('adminPanelTraveller', {
        travelersForAdmin
    });
});
app.post('/adminPanelTraveller', redirectAdmin, async (req, res) => {
    let id = req.body.id;
    let name = req.body.name.toLowerCase();
    let CNIC = req.body.CNIC;
    let city = req.body.tripcity.toLowerCase();
    let agent = req.body.agent;
    if (id.length == 0 && name.length == 0 && CNIC.length == 0 && city.length == 0 && agent.length == 0) {
        let [result, fields] = await db.execute('select * from customer');
        travelersForAdmin = result;
    } else if (id.length != 0) {
        let [result, fields] = await db.execute(`select * from customer where customerID = ${id}`);
        travelersForAdmin = result;
    } else if (CNIC.length != 0) {
        let [result, fields] = await db.execute(`select * from customer where CNIC = ${CNIC}`);
        travelersForAdmin = result;
    } else if (name.length != 0 && city.length != 0) {
        let [result, fields] = await db.execute(`select locationid from locations where locname = '${city}'`);
        [result, fields] = await db.execute(`select * from customer where locationid = ${result[0].locationid} AND fname ='${name}'`);
        travelersForAdmin = result;
    } else if (name.length != 0) {
        let [result, fields] = await db.execute(`select * from customer where fname = '${name}'`);
        travelersForAdmin = result;
    } else if (city.length != 0) {
        let [result, fields] = await db.execute(`select locationid from locations where locname = '${city}'`);
        [result, fields] = await db.execute(`select * from customer where locationid = ${result[0].locationid}`);
        travelersForAdmin = result;
    } else if (agent.length != 0) {
        [result, fields] = await db.execute(`select * from customer where agentid = ${agent}`);
        travelersForAdmin = result;
    }
    res.redirect('/adminPanelTraveller');
});
let withoutAgent = [];
let agents = [];
app.get('/ShowTravellerWithoutAgent', redirectAdmin, async (req, res) => {
    let [result, fields] = await db.execute('select * from customer c, locations l where c.agentID is null and l.locationID = c.locationID');
    withoutAgent = result;
    [result, fields] = await db.execute('select * from agent');
    agents = result;
    res.render('ShowTravellerWithoutAgent', {
        withoutAgent,
        agents
    });
});

app.post('/ShowTravellerWithoutAgent', redirectAdmin, async (req, res) => {
    let agent = req.body.agentID;
    let cusID = req.body.cusID;
    await db.execute(`update customer set agentid = ${agent} where customerid = ${cusID}`);
    let [oldCust,field] = await db.execute(`select noofcustomers+1 old from agent where agentid = ${agent}`);
    await db.execute(`update agent set noofcustomers = ${oldCust[0].old} where agentid = ${agent}`);
    [oldCust,field] = await db.execute(`(select commperperson old from salacom where salid = (select salid from agent where agentid = ${agent}))`);
    await db.execute(`update salacom set comm = comm + ${oldCust[0].old} where salid = (select salid from agent where agentid = ${agent})`);
    let [result, fields] = await db.execute(`select * from tripparticipants t where tripid = (select tripid from customer where customerid = ${cusID})`);
    if (result.length > 1) {
        let [others, f] = await db.execute(`select * from customer where tripid = ${result[0].TripID}`);
        others.forEach(async (travel) => {
            await db.execute(`update customer set agentid = ${agent} where customerid = ${travel.CustomerID}`);
        });
    }
    res.redirect('/ShowTravellerWithoutAgent')
});
let exist = false;
app.get('/addAgent', redirectAdmin, async (req, res) => {
    let sql = 'select * from locations';
    let locations;
    let [result, fields] = await db.execute(sql);
    locations = result;
    res.render('addAgent', {
        locations,
        exist
    });
});

app.post('/addAgent', redirectAdmin, async (req, res) => {
    let fname = req.body.fname.toLowerCase();
    let lname = req.body.lname.toLowerCase();
    let house = req.body.house.toLowerCase();
    let street = req.body.street.toLowerCase();
    let block = req.body.block.toLowerCase();
    let city = req.body.city.toLowerCase();
    let country = req.body.country.toLowerCase();
    let location = req.body.location;
    let sal = parseFloat(req.body.baseSal);
    let phone = req.body.phone;
    let email = req.body.email;
    let commRate = parseFloat(req.body.commRate);
    let [check, c] = await db.execute(`select * from authtable where name= ${phone}`);
    if (check.length != 0) {
        exist = true;
        res.redirect('addAgent');
    }
    let addressSql = `INSERT INTO address (House, Street, Block, City, Country) VALUES ('${house}', '${street}', '${block}', '${city}', '${country}')`;
    let contactSql = `INSERT INTO contactdetail (PhoneNo,Email) values (${phone},'${email}')`;
    let authSql = `INSERT INTO authtable (name,password,type) values ('${phone}', '${phone}','A')`;
    let addressID;
    let contactID;
    let authIDAgent;
    let [result, fields] = await db.execute(authSql);
    authIDAgent = result.insertId;
    [result, fields] = await db.execute(addressSql);
    addressID = result.insertId;
    [result, fields] = await db.execute(contactSql);
    contactID = result.insertId;
    let setBaseSal = `insert into salacom (sal,comm,CommPerPerson) values (${sal}, 0,${commRate})`;
    [result, fields] = await db.execute(setBaseSal);
    let agentSql = `INSERT INTO agent (FName, LName, LocationID, AddressID, AuthID, ContactID,salid,noofcustomers) VALUES ('${fname}', '${lname}', ${location}, ${addressID}, ${authIDAgent}, ${contactID}, ${result.insertId},0)`;
    [result, fields] = await db.execute(agentSql);
    customerID = result.insertId;
    res.redirect('/adminPanelAgent');
});
let idAgentToEdit;
app.get('/adminEditAgent', redirectAdmin, async (req, res) => {
    idAgentToEdit = req.query.id;
    let [details, fields] = await db.execute(`select * from agent a, salacom s, address ad, contactdetail c where a.agentID = ${idAgentToEdit} and s.salid = a.salid and c.contactid = a.contactid and ad.addressid = a.addressid`);
    let [result, field] = await db.execute(`select * from locations`);
    let locations = result;
    res.render('adminEditAgent', {
        details,
        locations
    });
});
app.post('/adminEditAgent', redirectAdmin, async (req, res) => {
    let fname = req.body.fname.toLowerCase();
    let lname = req.body.lname.toLowerCase();
    let house = req.body.house.toLowerCase();
    let street = req.body.street.toLowerCase();
    let block = req.body.block.toLowerCase();
    let city = req.body.city.toLowerCase();
    let country = req.body.country.toLowerCase();
    let location = req.body.location;
    let commRate = parseFloat(req.body.commRate);
    let sal = parseFloat(req.body.sal);
    let phone = req.body.phone;
    let email = req.body.email;
    let [result, fields] = await db.execute(`select * from agent where agentid = ${idAgentToEdit}`);
    db.execute(`update salacom set sal = ${sal}, commperperson = ${commRate} where salid = ${result[0].SalID}`);
    let addressSql = `UPDATE address SET House='${house}', Street='${street}', Block='${block}', City='${city}', Country='${country}' where addressid = ${result[0].AddressID}`;
    let contactSql = `UPDATE contactdetail SET PhoneNo=${phone},Email='${email}' where contactid = ${result[0].ContactID}`;
    db.execute(addressSql);
    db.execute(contactSql);
    let customerSql = `UPDATE agent set FName='${fname}', LName='${lname}', locationid=${location} where agentID = ${idAgentToEdit}`;
    db.execute(customerSql);
    res.redirect('/adminPanelAgent')
});

app.get('/adminShowAgent', redirectAdmin, async (req, res) => {
    let ver = req.query.ver;
    let id = req.query.id;
    let [result, fields] = await db.execute(`select * from agent a, salacom s, contactdetail c, address ad where a.agentID = ${id} and a.salid = s.salid and c.contactid = a.contactid and ad.addressid = a.addressid`);
    let [noofcus, f] = await db.execute(`select count(customerid) num from customer where agentid = ${result[0].AgentID} and registerDate > DATE_FORMAT(CURDATE(), '%Y-%m-01')`);
    let agentDetails = result;
    res.render('adminShowAgent', {
        ver,
        agentDetails,
        noofcus
    });
});
let invalid = false;
app.get('/agentSignInScreen', (req, res) => {
    res.render('agentSignInScreen', {
        invalid
    });
});
app.post('/agentSignInScreen', async (req, res) => {
    let name = req.body.name;
    let password = req.body.password;
    let [result, fields] = await db.execute(`select * from authtable where name ='${name}' and password='${password}' and type='A'`);
    if (result.length == 0) {
        invalid = true;
        res.redirect('/agentSignInScreen');
    } else {
        req.session.agentId = result[0].AuthID;
        authIDAgent = result[0].AuthID;
        res.redirect('/agentPanel');
    }
});
app.get('/agentPanel', redirectAgentLogin, (req, res) => {
    res.render('agentPanel');
});

let agentTraveler = [];
app.get('/agentTraveler', redirectAgentLogin, (req, res) => {
    res.render('agentTraveler', {
        agentTraveler
    });
});
app.get('/agentTravelerAll', redirectAgentLogin, async (req, res) => {
    let [result, fields] = await db.execute(`select * from agent where authid = ${authIDAgent}`);
    agentID = result[0].AgentID;
    [result, fields] = await db.execute(`select * from customer where agentid = ${agentID}`);
    agentTraveler = result;
    res.redirect('/agentTraveler');
});
app.get('/agentTravelerNAtt', redirectAgentLogin, async (req, res) => {
    let [result, fields] = await db.execute(`select * from agent where authid = ${authIDAgent}`);
    agentID = result[0].AgentID;
    [result, fields] = await db.execute(`select * from customer where agentid = ${agentID} and serviceid is null`);
    agentTraveler = result;
    res.redirect('/agentTraveler');
});
app.get('/agentTravelerAtt', redirectAgentLogin, async (req, res) => {
    let [result, fields] = await db.execute(`select * from agent where authid = ${authIDAgent}`);
    agentID = result[0].AgentID;
    [result, fields] = await db.execute(`select * from customer where agentid = ${agentID} and serviceid is not null`);
    agentTraveler = result;
    res.redirect('/agentTraveler');
});
app.post('/agentTraveler', redirectAgentLogin, async (req, res) => {
    let name = req.body.name;
    let id = req.body.id;
    let CNIC = req.body.CNIC;
    let [result, fields] = await db.execute(`select * from agent where authid = ${authIDAgent}`);
    agentID = result[0].AgentID;
    if (id.length == 0 && name.length == 0 && CNIC.length == 0) {
        let [result, fields] = await db.execute(`select * from customer where agentid = ${agentID}`);
        agentTraveler = result;
    } else if (id.length != 0) {
        let [result, fields] = await db.execute(`select * from customer where customerid = ${id} and agentid = ${agentID}`);
        agentTraveler = result;
    } else if (CNIC.length != 0) {
        let [result, fields] = await db.execute(`select * from customer where CNIC = ${CNIC} and agentid = ${agentID}`);
        agentTraveler = result;
    } else if (name.length != 0) {
        let [result, fields] = await db.execute(`select * from customer where fname = '${name}' and agentid = ${agentID}`);
        agentTraveler = result;
    }
    res.redirect('agentTraveler')
});

app.get('/agentMy', redirectAgentLogin, (req, res) => {
    res.render('agentMy');
});

app.get('/AgenteditDetails', redirectAgentLogin, async (req, res) => {
    let [result, fields] = await db.execute(`select * from locations`);
    let locations = result;
    [result, fields] = await db.execute(`select * from agent a, locations l, address ad, contactdetail c where a.authId = ${authIDAgent} and a.locationid = l.locationid and ad.addressid = a.addressid and a.contactid = c.contactid`);
    let agent = result;
    res.render('AgenteditDetails', {
        locations,
        agent
    });
});
app.post('/AgenteditDetails', redirectAgentLogin, async (req, res) => {
    let fname = req.body.fname.toLowerCase();
    let lname = req.body.lname.toLowerCase();
    let house = req.body.house.toLowerCase();
    let street = req.body.street.toLowerCase();
    let block = req.body.block.toLowerCase();
    let city = req.body.city.toLowerCase();
    let country = req.body.country.toLowerCase();
    let location = req.body.location;
    let phone = req.body.phone;
    let email = req.body.email;
    let [result, fields] = await db.execute(`select * from agent where authID = ${authIDAgent}`);
    let addressSql = `UPDATE address SET House='${house}', Street='${street}', Block='${block}', City='${city}', Country='${country}' where addressid = ${result[0].AddressID}`;
    let contactSql = `UPDATE contactdetail SET PhoneNo=${phone},Email='${email}' where contactid = ${result[0].ContactID}`;
    db.execute(addressSql);
    db.execute(contactSql);
    let customerSql = `UPDATE agent set FName='${fname}', LName='${lname}', locationid=${location} where authID = ${authIDAgent}`;
    db.execute(customerSql);
    res.redirect('/agentPanel')
});
let travelerToEdit;
let travelerLoc;
app.get('/agentEditTraveller', redirectAgentLogin, async (req, res) => {
    travelerToEdit = req.query.id;
    travelerLoc = req.query.loc;
    let [result, fields] = await db.execute(`select * from customer where customerID = ${travelerToEdit}`);
    detailsOfTraveler = result;
    [result, fields] = await db.execute(`select * from services s, bus b, flight f, hotel h, resturaunt r where s.serviceid = ${detailsOfTraveler[0].ServiceID} and s.busid = b.busid and s.flightid = f.flightid and s.hotelid = h.hotelid and s.resturauntid = r.resturauntid`);
    serviceDetails = result;
    let resturauntAddress;
    let hotelAddress;
    if (serviceDetails.length != 0) {
        [result, fields] = await db.execute(`select * from address where addressid = (select addressid from resturaunt where resturauntid = ${serviceDetails[0].ResturauntID})`);
        resturauntAddress = result;
        [result, fields] = await db.execute(`select * from address where addressid = (select addressid from hotel where hotelid = ${serviceDetails[0].HotelID})`);
        hotelAddress = result;
    }
    res.render('agentEditTraveller', {
        serviceDetails,
        resturauntAddress,
        hotelAddress
    });
});


app.post('/agentEditTraveller', redirectAgentLogin, async (req, res) => {
    let goFlight = req.body.goFlight;
    let dateOfGoFlight = req.body.dateOfGoFlight;
    let timeOfGoFlight = req.body.timeOfGoFlight;
    dateOfGoFlight = dateOfGoFlight + ' ' + timeOfGoFlight.slice(0, 5) + ':00 ' + timeOfGoFlight.slice(6, 8);
    let returnFlight = req.body.returnFlight;
    let dateOfReturnFlight = req.body.dateOfReturnFlight;
    let timeOfReturnFlight = req.body.timeOfReturnFlight;
    dateOfReturnFlight = dateOfReturnFlight + ' ' + timeOfReturnFlight.slice(0, 5) + ':00 ' + timeOfReturnFlight.slice(6, 8);;
    let resName = req.body.resName;
    let street = req.body.street;
    let block = req.body.block;
    let city = req.body.city;
    let country = req.body.country;
    let compName = req.body.compName;
    let busNum = req.body.busNum;
    let hotName = req.body.hotName;
    let hotStreet = req.body.hotStreet;
    let hotBlock = req.body.hotBlock;
    let hotCity = req.body.hotCity;
    let hotCountry = req.body.hotCountry;
    let busid;
    let restid;
    let hotid;
    let flightid;
    let serviceid;
    let [result, fields] = await db.execute(`insert into bus (BusServiceProvider,BusNum,locationid) values ('${compName}', '${busNum}',${travelerLoc})`);
    busid = result.insertId;
    [result, fields] = await db.execute(`INSERT INTO address (House, Street, Block, City, Country) VALUES ('${hotName}','${hotStreet}', '${hotBlock}', '${hotCity}', '${hotCountry}')`);
    [result, fields] = await db.execute(`insert into hotel (hotelName,locationID,addressid) values ('${hotName}', '${travelerLoc}', ${result.insertId})`);
    hotid = result.insertId;
    [result, fields] = await db.execute(`INSERT INTO address (House, Street, Block, City, Country) VALUES ('${resName}','${street}', '${block}', '${city}', '${country}')`);
    [result, fields] = await db.execute(`INSERT INTO resturaunt (ResturantName, locationid, addressid) VALUES ('${resName}',${travelerLoc}, ${result.insertId})`);
    restid = result.insertId;
    [result, fields] = await db.execute(`INSERT INTO flight (godeparturetime, returndeparturetime, goflightnumber, returnflightnumber) VALUES (STR_TO_DATE('${dateOfGoFlight}','%M %d,%Y %r'),STR_TO_DATE('${dateOfReturnFlight}','%M %d,%Y %r'), '${goFlight}', '${returnFlight}')`);
    flightid = result.insertId;
    [result, fields] = await db.execute(`INSERT INTO services (flightid, hotelid, resturauntid, busid) VALUES (${flightid}, ${hotid}, ${restid},${busid})`);
    serviceid = result.insertId;
    await db.execute(`update customer set serviceid = ${serviceid} where customerid =${travelerToEdit}`);
    res.redirect('/agentTraveler');
});
app.get('/deleteAgentConfirmation', redirectAgentLogin, async (req, res) => {
    let [result, fields] = await db.execute(`select * from agent where authid = ${authIDAgent}`);
    agentID = result[0].AgentID;
    db.execute(`update customer set agentid = NULL where agentid = ${agentID}`);
    db.execute(`delete from agent where AuthID = ${authIDAgent}`);
    db.execute(`delete from authtable where authid = ${authIDAgent}`);
    res.render('deleteAgentConfirmation');
});

app.get('/agentServices', redirectAgentLogin, (req, res) => {
    res.render('agentServices');
});
let paymentsToEdit;
app.get('/adminEditTraveler', async (req, res) => {
    let id = req.query.id;
    let [result, fields] = await db.execute(`select * from customer c, payments p where c.customerid = ${id} and c.paymentid = p.paymentid`);
    paymentsToEdit = result[0].PaymentID;
    res.render('adminEditTraveler', {
        result
    });
});
app.post('/adminEditTraveler', redirectAdmin, async (req, res) => {
    let totalCharges = req.body.totalCharges;
    let total = parseFloat(req.body.total);
    let addMore = parseFloat(req.body.AddMore);
    await db.execute(`update payments set TotalServiceCharges = ${totalCharges}, TotalRecived = ${total+addMore}, TotalDate = CURDATE()`);
    res.redirect('/adminPanelTraveller');
});
app.get('/adminDeleteTraveler', redirectAdmin, async (req, res) => {
    let id = req.query.id;
    let [result, fields] = await db.execute(`select * from customer where customerid = ${id}`);
    if (result[0].ServiceID != null) {
        let [service, field] = await db.execute(`select * from services where serviceid = ${result[0].ServiceID}`);
        await db.execute(`delete from bus where busid = ${service[0].BusID}`);
        await db.execute(`delete from hotel where hotelid = ${service[0].HotelID}`);
        await db.execute(`delete from resturaunt where resturauntid = ${service[0].ResturauntID}`);
        await db.execute(`delete from flight where flightid = ${service[0].FlightID}`);
        await db.execute(`delete from services where serviceid = ${result[0].ServiceID}`);
    }
    await db.execute(`delete from payments where paymentid = ${result[0].PaymentID}`);
    await db.execute(`delete from customer where customerid = ${id}`);
    res.render('adminDeleteTraveler');
});
detailsOfTraveler = [];
serviceDetails = [];
agentDetailsForTraveler = [];
app.get('/adminShowTraveler', redirectAdmin, async (req, res) => {
    let customerID = req.query.id;
    [result, fields] = await db.execute(`select * from customer c, payments p,address ad, contactdetail con where customerID = ${customerID} and c.paymentid = p.paymentid and ad.addressid = c.addressid and con.contactid = c.contactid`);
    detailsOfTraveler = result;
    [result, fields] = await db.execute(`select * from agent a, address ad, contactdetail con where a.agentid = ${result[0].AgentID} and ad.addressid = a.addressid and con.contactid = a.contactid`);
    agentDetailsForTraveler = result;
    [result, fields] = await db.execute(`select * from services s, bus b, flight f, hotel h, resturaunt r where s.serviceid = ${detailsOfTraveler[0].ServiceID} and s.busid = b.busid and s.flightid = f.flightid and s.hotelid = h.hotelid and s.resturauntid = r.resturauntid`);
    serviceDetails = result;
    let resturauntAddress;
    let hotelAddress;
    if (serviceDetails.length != 0) {
        [result, fields] = await db.execute(`select * from address where addressid = (select addressid from resturaunt where resturauntid = ${serviceDetails[0].ResturauntID})`);
        resturauntAddress = result;
        [result, fields] = await db.execute(`select * from address where addressid = (select addressid from hotel where hotelid = ${serviceDetails[0].HotelID})`);
        hotelAddress = result;
    }
    res.render('adminShowTraveler', {
        detailsOfTraveler,
        serviceDetails,
        agentDetailsForTraveler,
        resturauntAddress,
        hotelAddress
    });
});

app.get('/adminDeleteAgnet', redirectAdmin, async (req, res) => {
    let id = req.query.id;
    let [result, fields] = await db.execute(`select * from agent where agentid = ${id}`);
    await db.execute(`delete from salacom where salid = ${result[0].SalID}`);
    await db.execute(`delete from agent where agentid = ${id}`);
    await db.execute(`update customer set agentid = null where agentid = ${id}`);
    res.render('adminDeleteAgnet')
});

app.get('/showAgentDetails', redirectAgentLogin, async (req, res) => {
    let ver = req.query.ver;
    let [result, fields] = await db.execute(`select * from agent a, salacom s, contactdetail c, address ad where a.authid = ${authIDAgent} and a.salid = s.salid and c.contactid = a.contactid and ad.addressid = a.addressid`);
    let [noofcus, f] = await db.execute(`select count(customerid) num from customer where agentid = ${result[0].AgentID} and registerDate > DATE_FORMAT(CURDATE(), '%Y-%m-01')`);
    let agentDetails = result;
    res.render('showAgentDetails', {
        ver,
        agentDetails,
        noofcus
    });
});
let detailsForAgent = [];
app.get('/flight', redirectAgentLogin, async (req, res) => {
    res.render('flight', {
        detailsForAgent
    });
    detailsForAgent = [];
});
app.post('/flight', redirectAgentLogin, async (req, res) => {
    detailsForAgent = [];
    let id = req.body.id;
    let number = req.body.number;
    if (id.length == 0 && number.length == 0) {
        let [result, fields] = await db.execute(`select * from flight f`);
        detailsForAgent = result;
    } else if (id.length != 0) {
        let [result, fields] = await db.execute(`select * from flight where flightid = ${id}`);
        detailsForAgent = result;
    } else if (number.length != 0) {
        let [result, fields] = await db.execute(`select * from flight where  goFlightNumber= '${number}' or returnFlightNumber= '${number}'`);
        detailsForAgent = result;
    }
    res.redirect('/flight')
});
let hotels = [];
let show = false;
app.get('/hotel', redirectAgentLogin, async (req, res) => {
    let id = req.query.id;
    if (id != -9) {
        let [result, fields] = await db.execute(`select * from hotel h, address a where a.addressid = h.addressid and h.hotelid = ${id}`);
        hotels = result;
        show = true;
    }
    res.render('hotel', {
        hotels,
        show
    });
    hotels = [];
    show = false;
});
app.post('/hotel', redirectAgentLogin, async (req, res) => {
    let name = req.body.name;
    let id = req.body.id;

    if (id.length == 0 && name.length == 0) {
        let [result, fields] = await db.execute(`select * from hotel`);
        hotels = result;
    } else if (id.length != 0) {
        let [result, fields] = await db.execute(`select * from hotel where hotelid = ${id}`);
        hotels = result;
    } else if (name.length != 0) {
        let [result, fields] = await db.execute(`select * from hotel where hotelname = '${name}'`);
        hotels = result;
    }
    show = false;
    res.redirect('/hotel?id=-9')
});
let resturaunts = [];
app.get('/resturaunt', redirectAgentLogin, async (req, res) => {
    let id = req.query.id;
    if (id != -9) {
        let [result, fields] = await db.execute(`select * from resturaunt h, address a where a.addressid = h.addressid and h.resturauntid = ${id}`);
        resturaunts = result;
        show = true;
    }
    res.render('resturaunt', {
        resturaunts,
        show
    });
    resturaunts = [];
    show = false;
});
app.post('/resturaunt', redirectAgentLogin, async (req, res) => {
    let name = req.body.name;
    let id = req.body.id;

    if (id.length == 0 && name.length == 0) {
        let [result, fields] = await db.execute(`select * from resturaunt`);
        resturaunts = result;
    } else if (id.length != 0) {
        let [result, fields] = await db.execute(`select * from resturaunt where resturauntid = ${id}`);
        resturaunts = result;
    } else if (name.length != 0) {
        let [result, fields] = await db.execute(`select * from resturaunt where ResturantName = '${name}'`);
        resturaunts = result;
    }
    show = false;
    res.redirect('/resturaunt?id=-9')
});
let buses = [];
app.get('/bus', redirectAgentLogin, (req, res) => {
    res.render('bus', {
        buses
    });
    buses = [];
});
app.post('/bus', async (req, res) => {
    let name = req.body.name;
    let id = req.body.id;

    if (id.length == 0 && name.length == 0) {
        let [result, fields] = await db.execute(`select * from bus`);
        buses = result;
    } else if (id.length != 0) {
        let [result, fields] = await db.execute(`select * from bus where busid = ${id}`);
        buses = result;
    } else if (name.length != 0) {
        let [result, fields] = await db.execute(`select * from bus where BusServiceProvider = '${name}'`);
        buses = result;
    }
    res.redirect('/bus');
});
app.get('/addMoreLocation', redirectAdmin, (req, res) => {
    res.render('addMoreLocation');
});
app.post('/addMoreLocation', redirectAdmin, async (req, res) => {
    let name = req.body.name;
    let base = req.body.base;
    let country = req.body.country;
    let perDay = req.body.perDay;
    await db.execute(`insert into locations (locname,country,baseprice,costperday) values ('${name}', '${country}', ${base}, ${perDay})`);
    res.redirect('/adminPanel')
});
app.get('/editLocation', redirectAdmin, async (req, res) => {
    let [locations, fields] = await db.execute('select * from locations');
    res.render('editLocation', {
        locations
    });
});
app.post('/editLocation', redirectAdmin, async (req, res) => {
    let name = req.body.name;
    let [locations, fields] = await db.execute(`select * from locations where locname = '${name}'`);
    res.render('editLocation', {
        locations
    });
});
let idToEditLocation;
app.get('/editLocationNow', redirectAdmin, async (req, res) => {
    let id = req.query.id;
    idToEditLocation = id;
    let [result, fields] = await db.execute(`select * from locations where locationid = ${id}`);
    res.render('editLocationNow', {
        result
    });
});

app.post('/editLocationNow', redirectAdmin, async (req, res) => {
    let name = req.body.name;
    let base = req.body.base;
    let country = req.body.country;
    let perDay = req.body.perDay;
    idToEditLocation = req.query.id;
    await db.execute(`update locations set locname = '${name}', baseprice = ${base}, country = '${country}', costperday = ${perDay} where locationid =${idToEditLocation}`);
    res.redirect('/editLocation')
});

app.get('/changePasswordAgent', redirectAgentLogin, (req, res) => {
    res.render('changePasswordAgent', {
        notCorrect
    });
});
app.post('/changePasswordAgent', redirectAgentLogin, async (req, res) => {
    let checkIfMatch = `select * from authtable where password = '${req.body.oldPass}' and authid = ${authIDAgent}`;
    [result, fields] = await db.execute(checkIfMatch);
    if (result.length == 0) {
        notCorrect = true;
        res.redirect('/changePasswordAgent');
    } else {
        let changePassQuery = `UPDATE authtable SET password = '${req.body.newPass}' WHERE authtable.AuthID = ${result[0].AuthID};`;
        db.execute(changePassQuery);
    }
    res.redirect('/agentMy');
});


app.get('/showTravellerToAgent', redirectAgentLogin, async (req, res) => {
    let [result, field] = await db.execute(`select * from customer c, address a, contactdetail cd where c.customerid = ${req.query.id} and a.addressid = c.addressid and cd.contactid = c.contactid`);
    let [service, s] = await db.execute(`select * from services where serviceid = ${result[0].ServiceID}`);
    let [bus, b] = await db.execute(`select * from bus where busid = ${service[0].BusID}`);
    let [rest, r] = await db.execute(`select * from resturaunt r, address a where r.resturauntid = ${service[0].ResturauntID} and a.addressid = r.addressid`);
    let [hotel, h] = await db.execute(`select * from hotel h, address a where h.hotelid = ${service[0].HotelID} and a.addressid = h.addressid`);
    let [flight, f] = await db.execute(`select * from flight where flightid = ${service[0].FlightID}`);
    res.render('showTravellerToAgent', {
        result,
        flight,
        hotel,
        rest,
        bus
    });
});

app.get('/prices', async (req, res) => {
    let [result, field] = await db.execute('select mod(LocationID,6) color,LocName, country, BasePrice, CostPerDay from locations');
    res.render('prices', {
        result
    });
});

app.listen(5000, () => {
    console.log("Server Has Started!");
});