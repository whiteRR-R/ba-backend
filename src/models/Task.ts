import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface TaskAttributes {
  id: number;
  challengeId: number;
  title: string;
  description: string;
  day: number;
  isAiGenerated: boolean;
  deadline: Date;
}

interface TaskCreationAttributes
  extends Optional<TaskAttributes, 'id' | 'isAiGenerated'> {}

class Task extends Model<TaskAttributes, TaskCreationAttributes>
  implements TaskAttributes {
  public id!: number;
  public challengeId!: number;
  public title!: string;
  public description!: string;
  public day!: number;
  public isAiGenerated!: boolean;
  public deadline!: Date;
}

Task.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    challengeId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    day: { type: DataTypes.INTEGER, allowNull: false },
    deadline:    { type: DataTypes.DATE, allowNull: false },
    isAiGenerated: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { sequelize, tableName: 'tasks', timestamps: true }
);

export default Task;