
import { prisma } from '../models/prisma';

async function main() {
  const email = 'poonams@itm.edu';
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      const newUser = await prisma.user.create({
        data: {
          email,
          name: 'Poonam S',
          role: 'ADMIN'
        }
      });
      console.log('Created new admin user:', newUser);
    } else {
      const updatedUser = await prisma.user.update({
        where: { email },
        data: { role: 'ADMIN' }
      });
      console.log('Updated user to admin:', updatedUser);
    }
  } catch (error) {
    console.error('Error updating user role:', error);
  }
}

main();
