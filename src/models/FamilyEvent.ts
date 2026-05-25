import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface FamilyEventAttributes {
  id: number;
  userId: number;
  title: string;
  description?: string;
  year: number;
  month?: number;
  day?: number;
  emoji?: string;
}

interface FamilyEventCreationAttributes
  extends Optional<FamilyEventAttributes, 'id' | 'description' | 'month' | 'day' | 'emoji'> {}

class FamilyEvent extends Model<FamilyEventAttributes, FamilyEventCreationAttributes>
  implements FamilyEventAttributes {
  public id!: number;
  public userId!: number;
  public title!: string;
  public description?: string;
  public year!: number;
  public month?: number;
  public day?: number;
  public emoji?: string;
  public readonly createdAt!: Date;
}

FamilyEvent.init(
  {
    id:          { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId:      { type: DataTypes.INTEGER, allowNull: false },
    title:       { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    year:        { type: DataTypes.INTEGER, allowNull: false },
    month:       { type: DataTypes.INTEGER, allowNull: true },
    day:         { type: DataTypes.INTEGER, allowNull: true },
    emoji:       { type: DataTypes.STRING(10), allowNull: true },
  },
  { sequelize, tableName: 'family_events', timestamps: true }
);

export default FamilyEvent;