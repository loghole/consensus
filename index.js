const debugLiveTimeout = 250

function Syncer(name, cfg = { liveTimeout: debugLiveTimeout, debug: false }) {
    cfg.liveTimeout = cfg.liveTimeout <= 100 ? cfg.liveTimeout : debugLiveTimeout

    return {
        id: null,
        name: name,

        debug: cfg.debug,

        config: {
            liveTimeout: cfg.liveTimeout,
            voteTimeout: cfg.liveTimeout * 2,
            deadTimeout: cfg.liveTimeout * 5,
        },

        nodes: {},
        primaryNode: null,

        voteStarted: null,
        votes: {},

        primaryCb: null,
        replicaCb: null,

        liveChan: null,
        voteChan: null,

        liveInterval: null,
        voteInterval: null,

        readLiveEventFn: null,
        readVoteEventFn: null,

        init(primaryCb, replicaCb) {
            this.id = Math.random()

            this.liveChan = new BroadcastChannel(`syncer-live-chan-${this.name}`)
            this.voteChan = new BroadcastChannel(`syncer-vote-chan-${this.name}`)

            this.liveness()

            this.primaryCb = primaryCb
            this.replicaCb = replicaCb

            console.log(`syncer inited with id: ${this.id}, name: ${this.name}`)
        },

        destroy() {
            clearInterval(this.liveInterval)
            clearInterval(this.voteInterval)

            this.liveChan.removeEventListener("message", this.readLiveEventFn)
            this.voteChan.removeEventListener("message", this.readVoteEventFn)

            this.liveChan.close()
            this.voteChan.close()
        },

        liveness() {
            this.liveInterval = setInterval(() => {
                this.nodes[this.id] = Date.now()

                if (this.debug === true) {
                    console.log(this.id === this.primaryNode, this.nodes)
                }

                this.liveChan.postMessage({ id: this.id, ts: Date.now(), primary: this.id === this.primaryNode })
            }, this.config.liveTimeout)

            this.voteInterval = setInterval(() => {
                if (isNaN(this.nodes[this.primaryNode]) || Date.now() - this.nodes[this.primaryNode] >= this.config.deadTimeout) {
                    if (Date.now() - this.voteStarted >= this.config.voteTimeout + this.config.liveTimeout) {
                        this.startVote()
                    }
                }
            }, this.config.voteTimeout)

            this.readLiveEventFn = (event) => {
                this.readLiveEvent(event)
            }
            this.readVoteEventFn = (event) => {
                this.readVoteEvent(event)
            }

            this.liveChan.addEventListener("message", this.readLiveEventFn)
            this.voteChan.addEventListener("message", this.readVoteEventFn)
        },

        readVoteEvent({ data }) {
            this.startVote(data.voteID)

            this.voteFor(data.vote)

            this.isPrimary()
        },

        readLiveEvent({ data }) {
            this.nodes[this.parseID(data.id)] = data.ts

            if (data.primary === true && this.parseID(data.id) !== this.primaryNode) {
                this.setActive(data.id)
            }
        },

        startVote(voteID) {
            if (this.voteStarted && Date.now() - this.voteStarted < this.config.voteTimeout) {
                return
            }

            if (voteID === undefined) {
                voteID = Math.random()
            }

            this.votes = {}
            this.voteStarted = Date.now()

            this.cleanDeadNodes()

            const keys = Object.keys(this.nodes).sort((a, b) => {
                return (a.id < b.id) ? -1 : 1
            })

            this.voteChan.postMessage({
                voteID: voteID,
                id: this.id,
                vote: keys[0],
            })

            this.voteFor(keys[0])
            this.isPrimary()
        },

        voteFor(id) {
            id = this.parseID(id)

            if (this.votes[id] === undefined) {
                this.votes[id] = 0
            }

            this.votes[id]++
        },

        isPrimary() {
            if (this.countVotes() < Object.keys(this.nodes).length) {
                return
            }

            let max = 0
            let maxCount = 0
            let id = null

            Object.keys(this.votes).forEach(key => {
                if (max < this.votes[key]) {
                    max = this.votes[key]
                    id = key
                    maxCount = 1
                } else if (max === this.votes[key]) {
                    maxCount++
                }
            })

            if (maxCount > 1) {
                return
            }

            this.setActive(id)
        },

        setActive(id) {
            if (this.primaryNode === this.parseID(id)) {
                return
            } else if (this.parseID(id) !== this.id && this.primaryNode === this.id) {
                if (this.debug === true) {
                    console.log("is replica")
                }

                this.replicaCb(this.parseID(id))
            } else if (this.parseID(id) === this.id) {
                if (this.debug === true) {
                    console.log("is primary")
                }

                this.primaryCb(this.parseID(id))
            }

            this.primaryNode = this.parseID(id)
        },

        cleanDeadNodes() {
            Object.keys(this.nodes).forEach(k => {
                if (Date.now() - this.nodes[k] >= this.config.deadTimeout) {
                    delete this.nodes[k]
                }
            })
        },

        countVotes() {
            return Object.keys(this.votes).reduce((_, k) => {
                return this.votes[k]
            }, 0)
        },

        parseID(id) {
            return (typeof id === "number") ? id : parseFloat(id)
        }
    }
}

export default Syncer
