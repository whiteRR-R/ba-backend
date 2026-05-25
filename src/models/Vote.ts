import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface VoteAttributes {
  id: number;
  submissionId: number;
  voterId: number;
  score: number;
  isAnonymous: boolean;
  comment?: string;
}

interface VoteCreationAttributes
  extends Optional<VoteAttributes, 'id' | 'isAnonymous' | 'comment'> {}

class Vote extends Model<VoteAttributes, VoteCreationAttributes>
  implements VoteAttributes {
  public id!: number;
  public submissionId!: number;
  public voterId!: number;
  public score!: number;
  public isAnonymous!: boolean;
  public comment?: string;
  public readonly createdAt!: Date;
}

Vote.init(
  {
    id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    submissionId: { type: DataTypes.INTEGER, allowNull: false },
    voterId:      { type: DataTypes.INTEGER, allowNull: false },
    score:        { type: DataTypes.INTEGER, allowNull: false },
    isAnonymous:  { type: DataTypes.BOOLEAN, defaultValue: false },
    comment:      { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: 'votes', timestamps: true }
);

export default Vote;   // ✅ вот это было пропущено