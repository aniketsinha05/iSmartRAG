type SourceFiltersProps = {
  search: string;
  setSearch: (value: string) => void;
};

export default function SourceFilters({
  search,
  setSearch,
}: SourceFiltersProps) {
  return (
    <div className="search-box">
      🔍

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search sources..."
      />
    </div>
  );
}