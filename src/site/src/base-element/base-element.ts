import { pubsub } from "../data/pubsub";
import { tooltipManager } from "../rs-tooltip/tooltip-manager";

type EventUnbinder = () => void;
type PubSubHandler = (...args: unknown[]) => void;
type ListenableTarget = EventTarget & {
  addEventListener: EventTarget["addEventListener"];
  removeEventListener: EventTarget["removeEventListener"];
};

export class BaseElement extends HTMLElement {
  eventUnbinders: Set<EventUnbinder>;
  eventListeners: Map<ListenableTarget, Set<string>>;
  showingTooltip?: boolean;
  tooltipText?: string;

  constructor() {
    super();
    this.eventUnbinders = new Set();
    this.eventListeners = new Map();
  }

  connectedCallback(): void {}

  disconnectedCallback(): void {
    this.unbindEvents();
    if (this.showingTooltip) {
      this.showingTooltip = false;
      tooltipManager.hideTooltip();
    }
  }

  enableTooltip(): void {
    this.eventListener(this, "mouseover", (event) => this.handleMouseOver(event as MouseEvent));
    this.eventListener(this, "mouseout", this.handleMouseOut.bind(this));
  }

  updateTooltip(tooltipText: string): void {
    this.tooltipText = tooltipText;
    if (this.showingTooltip) {
      tooltipManager.showTooltip(tooltipText);
    }
  }

  handleMouseOver(mouseEvent: MouseEvent): void {
    const tooltipText = this.tooltipText || this.getAttribute("tooltip-text");
    if (tooltipText) {
      this.showingTooltip = true;
      this.updateTooltip(tooltipText.trim());
      mouseEvent.stopPropagation();
    }
  }

  handleMouseOut(): void {
    this.showingTooltip = false;
    tooltipManager.hideTooltip();
  }

  unbindEvents(): void {
    this.eventUnbinders.forEach((eventUnbinder) => {
      eventUnbinder();
    });
    this.eventUnbinders = new Set();
    this.eventListeners = new Map();
  }

  eventListener(
    subject: ListenableTarget,
    eventName: string,
    handler: EventListenerOrEventListenerObject,
    options: AddEventListenerOptions = {}
  ): void {
    if (!this.isConnected) {
      return;
    }

    if (!this.eventListeners.has(subject)) {
      this.eventListeners.set(subject, new Set());
    }

    const subjectEvents = this.eventListeners.get(subject);
    if (subjectEvents?.has(eventName)) {
      return;
    }

    subjectEvents?.add(eventName);
    subject.addEventListener(
      eventName,
      handler,
      Object.assign(
        {
          passive: true,
        },
        options
      )
    );
    this.eventUnbinders.add(() => subject.removeEventListener(eventName, handler));
  }

  subscribe(dataName: string, handler: PubSubHandler): void {
    if (!this.isConnected) {
      return;
    }

    pubsub.subscribe(dataName, handler);
    this.eventUnbinders.add(() => pubsub.unsubscribe(dataName, handler));
  }

  subscribeOnce(dataName: string, onEvent: PubSubHandler): void {
    const handler = (...args: unknown[]) => {
      if (this.eventUnbinders.has(unbinder)) {
        this.eventUnbinders.delete(unbinder);
        unbinder();
      }
      onEvent(...args);
    };

    const unbinder = () => pubsub.unsubscribe(dataName, handler);
    this.eventUnbinders.add(unbinder);
    pubsub.subscribe(dataName, handler);
  }

  html(): string {
    return "";
  }

  render(): void {
    this.innerHTML = this.html();
  }
}