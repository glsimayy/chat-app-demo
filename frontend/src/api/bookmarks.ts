const getBookmarks = () => {
  return Promise.resolve([]);
};

const deleteBookmark = (_id: number) => {
  return Promise.resolve("Bookmark removed");
};

const updateBookmark = (_id: number, data: object) => {
  return Promise.resolve(data);
};

export { getBookmarks, deleteBookmark, updateBookmark };
