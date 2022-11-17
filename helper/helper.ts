const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const generatePassword = (length: number = 16) => {
  let randomString: string = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    randomString += chars.substring(randomIndex, randomIndex + 1);
  }

  return randomString;
};
