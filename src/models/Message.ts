import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type ChatRoomType = 'family' | 'challenge';

interface MessageAttributes {
  id: number;
  roomType: ChatRoomType;
  roomId: number;       // familyOwnerId или challengeId
  userId: number;
  text: string;
}

interface MessageCreationAttributes
  extends Optional<MessageAttributes, 'id'> {}

class Message extends Model<MessageAttributes, MessageCreationAttributes>
  implements MessageAttributes {
  public id!: number;
  public roomType!: ChatRoomType;
  public roomId!: number;
  public userId!: number;
  public text!: string;
  public readonly createdAt!: Date;
}

Message.init(
  {
    id:       { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    roomType: { type: DataTypes.ENUM('family', 'challenge'), allowNull: false },
    roomId:   { type: DataTypes.INTEGER, allowNull: false },
    userId:   { type: DataTypes.INTEGER, allowNull: false },
    text:     { type: DataTypes.TEXT, allowNull: false },
  },
  { sequelize, tableName: 'messages', timestamps: true }
);

export default Message;