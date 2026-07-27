import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10)
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: 'admin' }, { email: 'admin@local' }]
    }
  })

  const admin = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          username: 'admin',
          email: 'admin@local',
          name: existing.name || 'Administrator',
          role: 'ADMIN',
          passwordHash
        }
      })
    : await prisma.user.create({
        data: {
          username: 'admin',
          email: 'admin@local',
          name: 'Administrator',
          role: 'ADMIN',
          passwordHash
        }
      })

  console.log(`Seeded admin user: ${admin.username} (id=${admin.id})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
