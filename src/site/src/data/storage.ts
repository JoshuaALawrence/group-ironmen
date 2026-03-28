import { storedGroupSchema, type StoredGroup } from "../validators";

class Storage {
  storeGroup(groupName: string, groupToken: string): void {
    const group = storedGroupSchema.parse({ groupName, groupToken });
    localStorage.setItem("groupName", group.groupName);
    localStorage.setItem("groupToken", group.groupToken);
  }

  getGroup(): StoredGroup | null {
    const parsedGroup = storedGroupSchema.safeParse({
      groupName: localStorage.getItem("groupName"),
      groupToken: localStorage.getItem("groupToken"),
    });

    return parsedGroup.success ? parsedGroup.data : null;
  }

  clearGroup(): void {
    localStorage.removeItem("groupName");
    localStorage.removeItem("groupToken");
  }
}

const storage = new Storage();

export { storage };