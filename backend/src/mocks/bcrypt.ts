//* Mocking the 'bcrypt' modules to test

const bcrypt = {
  hash: jest.fn(),
  compare: jest.fn(),
  genSalt: jest.fn(),
};

export default bcrypt;
export const { hash, compare, genSalt } = bcrypt;
