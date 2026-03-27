use std::collections::HashMap;
use std::sync::Mutex;
use tokio::sync::broadcast;

pub struct GroupEventNotifier {
    senders: Mutex<HashMap<i64, broadcast::Sender<()>>>,
}

impl GroupEventNotifier {
    pub fn new() -> Self {
        Self {
            senders: Mutex::new(HashMap::new()),
        }
    }

    pub fn subscribe(&self, group_id: i64) -> broadcast::Receiver<()> {
        self.get_or_create_sender(group_id).subscribe()
    }

    pub fn notify_group(&self, group_id: i64) {
        let sender = self.get_or_create_sender(group_id);
        let _ = sender.send(());
    }

    fn get_or_create_sender(&self, group_id: i64) -> broadcast::Sender<()> {
        let mut senders = self.senders.lock().unwrap();
        senders
            .entry(group_id)
            .or_insert_with(|| {
                let (sender, _) = broadcast::channel(32);
                sender
            })
            .clone()
    }
}