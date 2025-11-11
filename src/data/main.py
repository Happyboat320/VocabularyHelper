import csv
import json
import os

def extract_ielts_to_json(csv_path, output_path, min_fields=None):
    """
    从ECDICT CSV文件中提取雅思词汇并转换为JSON格式
    
    参数:
        csv_path: ECDICT csv文件路径 (如: ecdict.csv)
        output_path: 输出的JSON文件路径
        min_fields: 最小字段列表，确保输出的词条包含这些字段
    """
    if min_fields is None:
        min_fields = ['word', 'phonetic', 'translation', 'definition', 'example']
    
    ielts_words = []
    
    # 检查文件是否存在
    if not os.path.exists(csv_path):
        print(f"❌ 错误：找不到文件 {csv_path}")
        return []
    
    print(f"🔍 开始处理文件: {csv_path}")
    
    # 读取CSV文件 - 使用逗号分隔符（实际文件格式）
    with open(csv_path, 'r', encoding='utf-8') as f:
        # 使用逗号分隔，实际文件格式是CSV
        reader = csv.DictReader(f, delimiter=',')
        
        for row in reader:
            # 检查tag字段是否包含'ielts'（不区分大小写）
            if row.get('tag') and 'ielts' in row['tag'].lower():
                # 清洗数据：只保留需要的字段，跳过空值
                word_entry = {
                    'word': row.get('word', '').strip(),
                    'phonetic': row.get('phonetic', '').strip(),
                    'translation': row.get('translation', '').strip(),
                    'definition': row.get('definition', '').strip(),
                    'example': row.get('example', '').strip(),
                    'tag': row.get('tag', '').strip()
                }
                
                # 确保word字段非空
                if word_entry['word']:
                    # 检查是否包含所有最小要求字段（至少word和translation不为空）
                    if word_entry['word'] and word_entry['translation']:
                        ielts_words.append(word_entry)
    
    # 检查是否找到任何雅思词汇
    if not ielts_words:
        print("⚠️  警告：未找到任何包含'ielts'标签的词汇")
        print("   请检查CSV文件中'tag'列的内容格式")
    
    # 保存为JSON文件
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(ielts_words, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 提取完成！共 {len(ielts_words)} 个雅思词汇")
    print(f"📁 已保存到: {output_path}")
    return ielts_words

def extract_advanced_ielts_to_json(csv_path, output_path, min_fields=None):
    """
    从ECDICT CSV文件中提取雅思词汇，但排除高考以下水平的词汇（如中考zk、高考gk词汇）
    
    参数:
        csv_path: ECDICT csv文件路径 (如: ecdict.csv)
        output_path: 输出的JSON文件路径
        min_fields: 最小字段列表，确保输出的词条包含这些字段
    """
    if min_fields is None:
        min_fields = ['word', 'phonetic', 'translation', 'definition', 'example']
    
    advanced_ielts_words = []
    
    # 检查文件是否存在
    if not os.path.exists(csv_path):
        print(f"❌ 错误：找不到文件 {csv_path}")
        return []
    
    print(f"🔍 开始处理文件: {csv_path}")
    print(f"🔍 筛选条件: 雅思词汇 (ielts) 且 非高考以下词汇 (不含zk/gk)")
    
    # 高考以下的标签（中考、高考）
    basic_level_tags = ['zk', 'gk']  # zk=中考, gk=高考
    
    # 读取CSV文件
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter=',')
        
        for row in reader:
            tag = row.get('tag', '').lower()
            # 检查条件：包含ielts标签且不包含任何基础水平标签
            if tag and 'ielts' in tag:
                # 检查是否包含任何基础水平标签
                contains_basic_level = any(basic_tag in tag for basic_tag in basic_level_tags)
                
                # 只保留雅思词汇且不包含基础水平标签的词汇
                if not contains_basic_level:
                    # 清洗数据
                    word_entry = {
                        'word': row.get('word', '').strip(),
                        'phonetic': row.get('phonetic', '').strip(),
                        'translation': row.get('translation', '').strip(),
                        'definition': row.get('definition', '').strip(),
                        'example': row.get('example', '').strip(),
                        'tag': row.get('tag', '').strip()
                    }
                    
                    if word_entry['word'] and word_entry['translation']:
                        advanced_ielts_words.append(word_entry)
    
    # 检查是否找到任何词汇
    if not advanced_ielts_words:
        print("⚠️  警告：未找到符合条件的雅思高级词汇")
        print("   请检查CSV文件中'tag'列的内容格式")
    
    # 保存为JSON文件
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(advanced_ielts_words, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 提取完成！共 {len(advanced_ielts_words)} 个高级雅思词汇")
    print(f"📁 已保存到: {output_path}")
    return advanced_ielts_words

# 使用示例
if __name__ == "__main__":
    # 请修改为你的实际文件路径
    CSV_FILE = "d:\\desktop\\VocabularyHelper\\VocabularyHelper\\src\\data\\ecdict.csv"  # 使用双反斜杠避免转义问题
    
    # 1. 提取所有雅思词汇（原有功能）
    # OUTPUT_FILE = "ielts_vocabulary.json"
    # vocabulary = extract_ielts_to_json(CSV_FILE, OUTPUT_FILE)
    
    # 2. 提取高级雅思词汇（新功能）
    ADVANCED_OUTPUT_FILE = "advanced_ielts_vocabulary.json"
    advanced_vocabulary = extract_advanced_ielts_to_json(CSV_FILE, ADVANCED_OUTPUT_FILE)
    
    # 打印前5个单词查看效果
    print("\n预览前5个高级雅思单词:")
    for i, word in enumerate(advanced_vocabulary[:5]):
        print(f"{i+1}. {word['word']} - {word['translation'][:50]}...")
        print(f"   Tags: {word['tag']}")