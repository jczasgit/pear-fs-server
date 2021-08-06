// todo: REFACTOR CODE

require("dotenv").config();

const express = require("express");
const app = express();
const cors = require("cors");
const errorhandler = require("errorhandler");
const { Server: SocketServer } = require("socket.io");
const fs = require("fs");
const path = require("path");
const { customAlphabet } = require("nanoid");
const Room = require("./utils/room");
const Peer = require("./utils/peer");

const avatarJSON = JSON.parse(fs.readFileSync("./avatar.json"));
globalThis.socketToRoomId = new Map(); // <socketId, roomId>
globalThis.currentRooms = new Map(); // <roomId, Room>

const nanoid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  8
);

app.use(
  cors({
    methods: ["GET", "POST"],
    origin:
      process.env.NODE_ENV === "development"
        ? "*"
        : [
            "http://localhost:3000",
            /\.juancwu\.com$/,
            /pear-fs\.herokuapp\.com/,
          ],
  })
);

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/room", async (req, res) => {
  let roomId = nanoid();

  while (globalThis.currentRooms.has(roomId)) {
    roomId = nanoid();
  }

  res.json({
    roomId,
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
  app.use("/debug", require("./routes/debug"));
  app.use(errorhandler());
} else {
  app.use((err, req, res, next) => {
    // todo: record error in log
    // todo: redirect to code 500 page
    res.status(500).send("Server Side Error");
  });
}

const server = app.listen(process.env.PORT || 3001);

const io = new SocketServer({
  cors: {
    methods: ["GET", "POST"],
    origin: [
      "http://localhost:3000",
      /\.juancwu\.com$/,
      /pear-fs\.herokuapp\.com/,
    ],
  },
});

io.attach(server);

io.on("connection", (socket) => {
  console.log("new connection:", socket.id);

  /*  -----------   Room Event Management    --------------  */
  socket.on("greetings", () => socket.emit("greetings", socket.id));

  socket.on("join-room", (roomId, fn) => {
    // validate roomId input
    // avoid people submitting random strings as roomId
    if (!/^[A-Za-z0-9]{8}$/.test(roomId)) {
      // TODO: improve clean up, refactor (2)
      if (fn) return fn("");
      else return socket.emit("room-joined", "");
    }

    if (
      globalThis.currentRooms.has(roomId) &&
      globalThis.currentRooms.get(roomId).isFull()
    ) {
      if (fn)
        return fn({
          joined: false,
          roomId: "",
          peers: [],
        });

      return socket.emit("room-joined", {
        joined: false,
        roomId: "",
        peers: [],
      });
    }

    /**
     * @type {Room}
     */
    let room = globalThis.currentRooms.has(roomId)
      ? globalThis.currentRooms.get(roomId)
      : Room(roomId);

    socket.join(roomId);
    globalThis.socketToRoomId.set(socket.id, roomId);

    let peer = Peer(socket.id, Math.floor(Math.random() * 29), "anonymous");

    // todo: rafactor (1)
    let peers = [];
    for (let peer of room) {
      peers.push(peer.constructPeerData());
    }
    peers.unshift(peer);
    room.add(peer);

    globalThis.currentRooms.set(roomId, room);

    socket.to(roomId).emit("new-peer", peer.constructPeerData());

    if (fn) {
      fn({
        joined: true,
        roomId,
        peers,
      });
    } else {
      socket.emit("room-joined", {
        joined: true,
        roomId,
        peers,
      });
    }
  });

  socket.on("switch-room", (newRoomId, fn) => {
    // validate roomId input
    // avoid people submitting random strings as roomId
    if (!/^[A-Za-z0-9]{8}$/.test(newRoomId)) {
      // todo: handle clean up better, refactor (2)
      socket.leave(globalThis.socketToRoomId.get(socket.id));
      socket.disconnect();
      if (fn)
        return fn({
          joined: false,
          roomId: "",
          peers: [],
        });
      else
        return socket.emit("room-switched", {
          joined: false,
          roomId: "",
          peers: [],
        });
    }

    let oldRoomId = globalThis.socketToRoomId.get(socket.id);
    let oldRoom = globalThis.currentRooms.get(oldRoomId);
    let newRoom = globalThis.currentRooms.has(newRoomId)
      ? globalThis.currentRooms.get(newRoomId)
      : Room(newRoomId);

    if (newRoom.isFull()) {
      if (fn) return fn("");
      else return socket.emit("room-switched", "");
    }

    /**
     * @type {Peer}
     */
    let socketPeer; // we need to get a hold of the peer before removing it from the old room members array.
    if (oldRoom && oldRoom.has(socket.id)) {
      socketPeer = oldRoom.get(socket.id);
      oldRoom.remove(socket.id);
      if (oldRoom.isEmpty()) {
        globalThis.currentRooms.delete(oldRoomId);
      } else {
        globalThis.currentRooms.set(oldRoomId, oldRoom);
      }
    }

    // Since in the client side a mapping can be done against
    // the socket id, then no more info is necessary.
    socket.leave(oldRoomId);
    socket.to(oldRoomId).emit("peer-exit", socket.id);

    // notify all members in new room that a new peer has joined the room
    socket.join(newRoomId);
    socket.to(newRoomId).emit("peer-join", socketPeer.constructPeerData());

    globalThis.currentRooms.set(newRoomId, newRoom);
    globalThis.socketToRoomId.set(socket.id, newRoomId);

    // Send back all the current peers in new room to the newly joined member
    // todo: refactor (1)
    let peers = [];
    for (let peer of newRoom) {
      peers.push(peer.constructPeerData());
    }
    peers.unshift(socketPeer);
    newRoom.add(socketPeer);

    if (fn)
      fn({
        joined: true,
        roomId: newRoomId,
        peers,
      });
    else
      socket.emit("room-switched", {
        joined: true,
        roomId: newRoomId,
        peers,
      });
  });

  socket.on("new-nickname", (nickname) => {
    /**
     * @type {Room}
     */
    let room = globalThis.currentRooms.get(
      globalThis.socketToRoomId.get(socket.id)
    );
    if (!room) return;

    room.__members = room.__members.map(
      /**
       *
       * @param {Peer} peer
       */
      (peer) => {
        if (peer.peerId === socket.id) {
          peer.nickname = nickname;
        }

        return peer;
      }
    );

    globalThis.currentRooms.set(globalThis.socketToRoomId.get(socket.id), room);

    socket
      .to(globalThis.socketToRoomId.get(socket.id))
      .emit("new-nickname", { nickname, peerId: socket.id });
  });
  /*  -----------   End of Room Event Management    --------------  */

  /*  -----------   Signal Events    --------------  */
  // signal data properties:👇👇👇
  // payload: string, from: string, to: string
  socket.on("signal", (signal) => {
    socket.to(signal.to).emit("signal", signal.payload, signal.from);
  });

  socket.on("answer", (signal) => {
    socket.to(signal.to).emit("answer", signal.payload);
  });

  socket.on("ping-peer", (id) => {
    socket.to(id).emit("ping-peer", socket.id);
  });

  socket.on("pong-peer", (id) => {
    socket.to(id).emit("pong-peer", socket.id);
  });
  /*  -----------  End of Signal Events    --------------  */

  socket.once("disconnect", (r) => {
    console.log("socket disconnected: ", r);

    let roomId = globalThis.socketToRoomId.get(socket.id);
    let room = globalThis.currentRooms.get(roomId);

    if (room) {
      room.remove(socket.id);

      if (room.isEmpty()) {
        globalThis.currentRooms.delete(roomId);
      }
    }

    // Notify other sockets that are still in the room.
    socket
      .to(globalThis.socketToRoomId.get(socket.id))
      .emit("peer-exit", socket.id);

    // Remove socket from socket to room id map
    globalThis.socketToRoomId.delete(socket.id);

    // remove all event listeners to liberate memory space
    socket.removeAllListeners();
  });
});
