import { storedGroupSchema } from "../validators";

class Storage {
  storeGroup(groupName, groupToken) {
    const group = storedGroupSchema.parse({ groupName, groupToken });
    localStorage.setItem("groupName", group.groupName);
    localStorage.setItem("groupToken", group.groupToken);
  }

  getGroup() {
    const parsedGroup = storedGroupSchema.safeParse({
      groupName: localStorage.getItem("groupName"),
      groupToken: localStorage.getItem("groupToken"),
    });

    return parsedGroup.success ? parsedGroup.data : null;
  }

  clearGroup() {
    localStorage.removeItem("groupName");
    localStorage.removeItem("groupToken");
  }
}

const storage = new Storage();

export { storage };
