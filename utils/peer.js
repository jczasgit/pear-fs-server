/**
 * @constructor
 * @param {string} peerId
 * @param {string} avatarId
 * @param {string} nickname
 * @returns {Peer}
 */
function Peer(peerId, avatarId, nickname) {
  if (!(this instanceof Peer)) return new Peer(peerId, avatarId, nickname);

  this.peerId = peerId;
  this.avatarId = avatarId;
  this.nickname = nickname;
}

Peer.prototype.constructPeerData = function () {
  return {
    peerId: this.peerId,
    avatarId: this.avatarId,
    nickname: this.nickname,
  };
};

module.exports = Peer;
