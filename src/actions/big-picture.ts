import { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { Steam } from '../services/steam';


type BigPictureSettings = {
    bigPictureOpen?: boolean;
    longPressThresholdMs?: number;
};

/**
 * Enable/disable steam's Big Picture mode.
 */
@action({ UUID: "com.wheeewhooo.superior-steam.big-picture" })
export class BigPicture extends SingletonAction {
    private pressStartTime: number = 0;
    private readonly LONG_PRESS_THRESHOLD = 500; // 500ms
    
    /**
     * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it becomes visible. This could be due to the Stream Deck first
     * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}. In this example,
     * we're setting the title to the "count" that is incremented in {@link IncrementCounter.onKeyDown}.
     */
    override onWillAppear(ev: WillAppearEvent<BigPictureSettings>): void | Promise<void> {
        const isOpen = ev.payload.settings.bigPictureOpen ?? false;
        return ev.action.setTitle(isOpen ? "BP: ON" : "BP: OFF");
    }


    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        this.pressStartTime = Date.now();
    }

    /**
     * Listens for the {@link SingletonAction.onKeyDown} event which is emitted by Stream Deck when an action is pressed. Stream Deck provides various events for tracking interaction
     * with devices including key down/up, dial rotations, and device connectivity, etc. When triggered, {@link ev} object contains information about the event including any payloads
     * and action information where applicable. In this example, our action will display a counter that increments by one each press. We track the current count on the action's persisted
     * settings using `setSettings` and `getSettings`.
     */
    override async onKeyUp(ev: KeyUpEvent<BigPictureSettings>): Promise<void> {
        const pressDuration = Date.now() - this.pressStartTime;
        const { settings } = ev.payload;
        const threshold = settings.longPressThresholdMs ?? this.LONG_PRESS_THRESHOLD;
        const steam = new Steam();
        
        if (pressDuration >= threshold) {
            // Long press - close Big Picture
            await steam.closeBigPicture();
            await ev.action.setSettings({ ...settings, bigPictureOpen: false });
            await ev.action.setTitle("BP: OFF");
        } else {
            // Short press - open Big Picture
            await steam.openBigPicture();
            await ev.action.setSettings({ ...settings, bigPictureOpen: true });
            await ev.action.setTitle("BP: ON");
        }
    }
}


