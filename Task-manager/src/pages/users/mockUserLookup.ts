// src/pages/users/mockUserLookup.ts
export const getUsers = async () => {
  // return minimal user list: id & name
  // If you have current users stored in localStorage under mockUsersDB (from earlier services), use that instead
  const raw = localStorage.getItem("mockUsersDB") || localStorage.getItem("app_users_v1");
  if (!raw) {
    const seed = [
      { id: 1, name: "Sarah Wilson" },
      { id: 2, name: "John Smith" },
      { id: 3, name: "Mike Johnson" },
    ];
    localStorage.setItem("mockUsersDB", JSON.stringify(seed));
    return seed;
  }
  try {
    const parsed = JSON.parse(raw);
    // if objects have firstName/lastName, map to name
    if (parsed.length && parsed[0].firstName) {
      return parsed.map((u:any) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }));
    }
    return parsed.map((u:any)=>({id:u.id, name:u.name||u.email||`User ${u.id}`}));
  } catch {
    return [];
  }
};
