import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { UserRole } from '../types';

interface UserAttributes {
  id: number;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  rating: number;
  rikonCoins: number;
  avatarUrl?: string;
  // ✅ Приватность
  showChallengesPublic?: boolean;
  allowFamilyInvites?: boolean;
  allowChallengeInvites?: boolean;
}

interface UserCreationAttributes
  extends Optional<UserAttributes, 'id' | 'rating' | 'rikonCoins' | 'showChallengesPublic' | 'allowFamilyInvites' | 'allowChallengeInvites'> { }

class User extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes {
  public id!: number;
  public username!: string;
  public email!: string;
  public password!: string;
  public role!: UserRole;
  public rating!: number;
  public rikonCoins!: number;
  public avatarUrl?: string;
  public showChallengesPublic?: boolean;
  public allowFamilyInvites?: boolean;
  public allowChallengeInvites?: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    role: {
      type: DataTypes.ENUM('admin', 'moderator', 'user'),
      defaultValue: 'user',
    },
    rating: { type: DataTypes.INTEGER, defaultValue: 0 },
    rikonCoins: { type: DataTypes.INTEGER, defaultValue: 100 },
    avatarUrl: { type: DataTypes.STRING(500), allowNull: true },

    // ✅ Приватность (3 поля, без showRatingPublic)
    showChallengesPublic: { type: DataTypes.BOOLEAN, defaultValue: true },
    allowFamilyInvites: { type: DataTypes.BOOLEAN, defaultValue: true },
    allowChallengeInvites: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, tableName: 'users', timestamps: true }
);

export default User;