/**
 * Create new Room instance.
 * @constructor
 * @param {string} id - ID of the room
 */
function Room(id) {
  if (!(this instanceof Room)) return new Room(id);

  this.id = id;
  this.__members = []; // Array of Peer objects
}

/**
 * Check if socket with id is in Room
 * @param {string} id - socket id
 * @returns {boolean}
 */
Room.prototype.has = function (id) {
  for (let i = 0; i < this.__members.length; i++) {
    if (this.__members[i].peerId === id) return true;
  }

  return false;
};

/**
 * Check if Room is full
 * @returns {boolean}
 */
Room.prototype.isFull = function () {
  return this.__members.length === 6;
};

/**
 * Check if Room is empty
 * @returns {boolean}
 */
Room.prototype.isEmpty = function () {
  return this.__members.length === 0;
};

/**
 * Add a new socket to Room.
 * Returns false if Room is full, otherwise true.
 * @param {import("./peer")} peer
 * @returns {boolean}
 */
Room.prototype.add = function (peer) {
  if (!this.isFull()) {
    this.__members.push(peer);
    return true;
  } else {
    return false;
  }
};

/**
 * Removes a socket id from the Room.
 * @param {string} id socket id to remove from Room
 */
Room.prototype.remove = function (id) {
  this.__members = this.__members.filter((v) => v.peerId !== id);
};

/**
 *
 * @param {string} id
 * @returns {Peer | null}
 */
Room.prototype.get = function (id) {
  for (let p of this) {
    if (p.peerId === id) {
      return p;
    }
  }
  return null;
};

/**
 * for(let peer of Room)
 * @returns Iterator
 */
Room.prototype[Symbol.iterator] = function () {
  let counter = 0;
  const fn = () => {
    let done = counter === this.__members.length;
    let value = this.__members[counter];
    counter += 1;
    return {
      done,
      value,
    };
  };

  fn.bind(this);

  return {
    next: fn,
  };
};

module.exports = Room;
