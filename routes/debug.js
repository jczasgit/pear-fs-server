const router = require("express").Router();

router.get("/current-rooms", (req, res) => {
  let json = {};
  globalThis.currentRooms.forEach((room) => {
    json[room.id] = {
      members: room.__members,
    };
  });

  res.json(json);
});

router.get("/current-rooms/:id", (req, res) => {
  let json = {};
  if (globalThis.currentRooms.has(req.params.id)) {
    let room = globalThis.currentRooms.get(req.params.id);
    json[room.id] = {
      members: room.__members,
    };
  }

  res.json(json);
});

router.get("/socket-to-room/:id", (req, res) => {
  let json = {};
  if (globalThis.socketToRoomId.has(req.params.id)) {
    let roomId = globalThis.socketToRoomId.get(req.params.id);
    json["socket"] = req.params.id;
    json["roomId"] = roomId;
  }

  res.json(json);
});

module.exports = router;
