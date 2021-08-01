# Consensus

[![npm version](https://img.shields.io/npm/v/@loghole/consensus.svg?style=flat-square)](https://www.npmjs.com/package/@loghole/consensus)

Allows to select the primary tab among the open. Can use this together with server-sent events.

## Installation

Using npm:

```sh
npm i @loghole/consensus
```

Using yarn:

```sh
yarn add @loghole/consensus
```

## Example

Base:
```javascript
import Consensus from "@loghole/consensus";

const consensus = new Consensus("example")

consensus.init(
    () => { // notification about this tab is primary.
      console.log("is primary")
    },
    () => { // notification about this tab is replica.
      console.log("is replica")
    },
)

window.addEventListener('unload', () => {
  consensus.destroy()
})
```

Simple example with server-sent events:
```javascript
import Consensus from "@loghole/consensus";

const consensus = new Consensus("sse-example", { debug: true });
const broadcast = new BroadcastChannel("broadcast-bus");

let source = undefined;

broadcast.addEventListener("message", ({ data }) => {
  console.log(`received sse event from broadcast: ${data}`);
});

function initSSE() {
  source = new EventSource(`/sse`, {
    withCredentials: true,
  });

  source.addEventListener("example", ({ data }) => {
    console.log(`received sse event: ${data}`);

    broadcast.postMessage({ data: data });
  });
}

function closeSSE() {
  if (source) {
    source.close();
    source = undefined;
  }
}

consensus.init(
  () => { initSSE(); },
  () => { closeSSE(); }
);

window.addEventListener("unload", () => {
  consensus.destroy();
});
```

## Browser Support
* [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) support required. [Check](https://caniuse.com/broadcastchannel).
