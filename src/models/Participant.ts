import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ParticipantAttributes {
  id: number;
  challengeId: number;
  userId: number;
  score: number;
  hasConsented: boolean; // Согласие на медиа (из ТЗ)
}

interface ParticipantCreationAttributes
  extends Optional<ParticipantAttributes, 'id' | 'score' | 'hasConsented'> {}

class Participant extends Model<ParticipantAttributes, ParticipantCreationAttributes>
  implements ParticipantAttributes {
  public id!: number;
  public challengeId!: number;
  public userId!: number;
  public score!: number;
  public hasConsented!: boolean;
}

Participant.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    challengeId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    score: { type: DataTypes.FLOAT, defaultValue: 0 },
    hasConsented: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { sequelize, tableName: 'participants', timestamps: true }
);

export default Participant;