class Node {
    constructor(value) {
        this.value = value;
        this.next = null;
    }
}

export class NodeQueue {
    constructor() {
        this.front = null;
        this.rear = null;
        this.length = 0;
    }

    enqueue(value) {
        const newNode = new Node(value);
        if (this.isEmpty()) {
        this.front = this.rear = newNode;
        } else {
        this.rear.next = newNode;
        this.rear = newNode;
        }
        this.length++;
    }

    dequeue() {
        if (this.isEmpty()) {
            return null;
        }
        const removedValue = this.front.value;
        this.front = this.front.next;
        if (!this.front) {
            this.rear = null;
        }
        this.length--;
        return removedValue;
    }

    peek() {
        return this.isEmpty() ? null : this.front.value;
    }

    isEmpty() {
        return this.length === 0;
    }

    size() {
        return this.length;
    }

    getRear() {
        return this.isEmpty() ? null : this.rear.value
    }

    clear() {
        this.font = null
        this.rear = null
        this.length = 0
    }

    toArray() {
        var result = [];
        let current = this.front;
        while (current) {
            result.push(current.value);
            current = current.next;
        }
        return result;
    }
}