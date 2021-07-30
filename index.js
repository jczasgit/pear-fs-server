// const { Server } = require("socket.io");
const express = require("express");
const app = express();
const cors = require("cors");
const errorhandler = require("errorhandler");
const { Server: SocketServer } = require("socket.io");
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");

const avatarJSON = JSON.parse(fs.readFileSync("avatar.json"));
const socketToRoom = new Map();

app.use(
  cors({
    methods: ["GET", "POST"],
    origin: ["http://localhost:3000", /\.juancwu\.com$/],
  })
);

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/room", (req, res) => {
  // note: hopefully there wont be any collision 😅
  res.json({
    roomId: nanoid(),
  });
});

app.get("/api/avatar/:id", (req, res) => {
  let { id } = req.params;

  let avatarInfo = avatarJSON[id];

  if (typeof avatarInfo === "undefined") {
    return res.status(404).json({ status: 404 });
  }

  res.status(200).json(avatarInfo);
});

if (process.env.NODE_ENV === "development") {
  app.use(errorhandler());
} else {
  app.use((err, req, res, next) => {
    // todo: record error in log
    // todo: redirect to code 500 page
    res.status(500).send("Server Side Error");
  });
}

const server = app.listen(3001);

const io = new SocketServer();

io.attach(server);

io.on("connection", (socket) => {
  console.log("new connection:", socket.id);

  socket.emit("greetings", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socketToRoom.set(socket.id, roomId);

    socket.to(roomId).emit("new-peer", socket.id);

    socket.emit("room-joined", roomId);
  });

  socket.once("disconnect", (r) => {
    console.log("socket disconnected: ", r);
    socket.to(socketToRoom.get(socket.id)).emit("peer-exit", socket.id);
    socket.removeAllListeners();
  });
});
