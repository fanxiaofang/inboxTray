import { Item } from '../types';
import ItemCard from './ItemCard';

interface ItemListProps {
  items: Item[];
  onRefresh: () => void;
}

export default function ItemList({ items, onRefresh }: ItemListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-app-muted/50">
        <p className="text-sm">暂无内容</p>
        <p className="text-xs mt-1">在上方输入框添加第一条记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} onRefresh={onRefresh} />
      ))}
    </div>
  );
}
