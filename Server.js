// creating server instance
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
// database connection instance
const mysql = require("mysql2");
const con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "arduino_db",
});

// creating a serial port instance
const { SerialPort } = require("serialport");
const port = new SerialPort({
  path: "COM3",
  baudRate: 9600,
  autoOpen: false,
}); // creating port instance
const app = express(); // creating express instance
const httpServer = createServer(app); // creating http server instance
// allow cors for all origins
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    allowedHeaders: ["Access-Control-Allow-Origin"],
    credentials: true,
  },
});

// CHECK PORT CONNECTION 
// open port on server start
openPort();
function openPort() {
  // open the port
  port.open(function (err) {
    if (err) {
      console.log("Error opening port: ", err.message);
      data = {
        temp: 0,
        hum: 0,
        AutoMan: 0,
        fanState: 0,
        windowState: 0,
      };
      // console.log(data);
      io.emit("DATA", data);
      setTimeout(openPort, 2000);
    } else {
      console.log("Port opened");
      // retrieve data from database and send to client
      
      return;
    }
  });
}

// Read data from the port and send it to the client
port.on("open", function (err) {
  if (err) {
    openPort();
  }
  let temperature = 0;
  let humidity = 0;
  let counter = 0;

  // open logic
  //   read data from port
  port.on("data", function (data) {
    data = data.toString();
    // remove the new line character
    data = data.replace(/(\r\n|\n|\r)/gm, ",");
    // split the data
    
    data = data.split(",");
    data = {
      temp: data[0],
      hum: data[1],
      AutoMan: Boolean(Number(data[2])),
      fanState: Boolean(Number(data[3])),
      windowState: Boolean(Number(data[4])),
    };
    // send data to client every 250ms

    io.emit("DATA", data);
    retrieveData();

    //  store data every 1min in database
    // 1min = 240 * 250ms
    counter++;
    temperature = temperature + Number(data.temp);
    humidity = humidity + Number(data.hum);
    if (counter === 240) {
      // store data in database
      temperature = Math.floor(Number(temperature / 240));
      humidity = Math.floor(Number(humidity / 240));
      counter = 0;
      storeData(temperature, humidity);
    }
  });
});
// 


// Store data in database every 1min and retrieve data every 1min
function storeData(temperature, humidity) {
  // check if temperature and humidity is a number or not
  temperature = Number(temperature);
  humidity = Number(humidity);
  if (isNaN(temperature) || isNaN(humidity)) {
    console.log("Invalid data");
    return;
  }
  // store data in database
  con.connect(function (err) {
    if (err) throw err;
    var sql = `INSERT INTO sensor_data (timestamp_, temperature, humidity) VALUES (CURRENT_TIME(), ${temperature}, ${humidity})`;
    con.query(sql, function (err, result) {
      if (err) throw err;
      console.log("1 record inserted: " + temperature + ", " + humidity);
      retrieveData();
    });
  });
}
// retrieve data from database when server starts
retrieveData();
function retrieveData() {
  var sql = "SELECT * FROM sensor_data ORDER BY timestamp_ DESC LIMIT 12;";
  con.query(sql, function (err, result) {
    if (err) throw err;
    io.emit("CHART", result);
  });

}



// detect port disconnect
port.on("close", function (err) {
  console.log("Port closed");
  openPort();
});


// listen to client events and send to serial port
io.on("connection", (socket) => {
  socket.on("AutoMan", (arg) => {
    console.log("A");
    port.write("A");
  });
  // clear garbage value in server
});
io.on("connection", (socket) => {
  socket.on("fanState", (arg) => {
    port.write("W");
  });
});
io.on("connection", (socket) => {
  socket.on("airconState", (arg) => {
    port.write("F");
  });
});



// get local ip address
const { networkInterfaces } = require("os");
const nets = networkInterfaces();
const results = Object.create(null); // Create an empty object to store results
for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    // Check if it's an IPv4 address and not internal or a loopback address
    if (net.family === "IPv4" && !net.internal) {
      if (!results[name]) {
        results[name] = [];
      }
      results[name].push(net.address);
    }
  }
}
// if wifi is not available the use local host
let localIpAddress;
const networkInterfaceName = Object.keys(results)[0];
console.log(networkInterfaceName);
//  if networkInterfaceName is undefined
if (networkInterfaceName === undefined) {
  localIpAddress = "localhost";
} else {
  localIpAddress = results[networkInterfaceName][0];
}
const portNumber = 8080; // port number
httpServer.listen(portNumber, localIpAddress, () => {
  console.log(`Server is running on http://${localIpAddress}:${portNumber}`);
});
